import { describe, it, expect, beforeEach, vi } from "vitest";
import worker, { type Env } from "./index";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock KVNamespace
class MockKVNamespace {
  store = new Map<string, string>();
  
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  
  async put(key: string, value: string, options?: any) {
    this.store.set(key, value);
  }
  
  async list(options?: any) {
    const prefix = options?.prefix ?? "";
    const limit = options?.limit ?? 1000;
    const keys = Array.from(this.store.keys())
      .filter((k) => k.startsWith(prefix))
      .slice(0, limit)
      .map((name) => ({ name }));
    return { keys, list_complete: true };
  }
}

// Mock ExecutionContext
const mockCtx = {
  waitUntil: vi.fn((promise: Promise<any>) => promise),
  passThroughOnException: vi.fn(),
};

describe("Cloudflare Worker", () => {
  let env: Env;
  let mockKV: MockKVNamespace;

  beforeEach(() => {
    mockFetch.mockReset();
    mockCtx.waitUntil.mockReset();
    mockKV = new MockKVNamespace();
    
    env = {
      GROQ_API_KEY: "mock-groq-key",
      GEMINI_API_KEY: "mock-gemini-key",
      ADMIN_TOKEN: "mock-admin-token",
      MEMORY: mockKV as any,
      ALLOWED_ORIGINS: "http://localhost:5173,https://officialwhyed.github.io",
    };
  });

  describe("Health & Root Route", () => {
    it("should return alive status for GET /", async () => {
      const req = new Request("http://localhost/", { method: "GET" });
      const res = await worker.fetch(req, env, mockCtx as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ ok: true, service: "whychat", soul: "alive" });
    });

    it("should return alive status for GET /health", async () => {
      const req = new Request("http://localhost/health", { method: "GET" });
      const res = await worker.fetch(req, env, mockCtx as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ ok: true, service: "whychat", soul: "alive" });
    });
  });

  describe("CORS Handling", () => {
    it("should allow approved origin", async () => {
      const req = new Request("http://localhost/", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:5173" },
      });
      const res = await worker.fetch(req, env, mockCtx as any);
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    });

    it("should block unapproved origin", async () => {
      const req = new Request("http://localhost/", {
        method: "OPTIONS",
        headers: { Origin: "https://evil.com" },
      });
      const res = await worker.fetch(req, env, mockCtx as any);
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("null");
    });

    it("should block API request from unapproved origin", async () => {
      const req = new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          Origin: "https://evil.com",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: [] }),
      });
      const res = await worker.fetch(req, env, mockCtx as any);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("origine non consentita");
    });
  });

  describe("Rate Limiting", () => {
    it("should block after reaching rate limit limit", async () => {
      const ip = "127.0.0.1";
      const encoder = new TextEncoder();
      const buf = await crypto.subtle.digest("SHA-256", encoder.encode(ip));
      const hash = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
      const key = `rate:${hash}`;
      mockKV.store.set(key, "40");

      const req = new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "CF-Connecting-IP": "127.0.0.1",
          Origin: "http://localhost:5173",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hi" }],
        }),
      });

      const res = await worker.fetch(req, env, mockCtx as any);
      if (res.status !== 429) {
        console.log("Response status:", res.status);
        console.log("Response text:", await res.text());
      }
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toBe("troppe richieste, riprova tra poco");
    });
  });

  describe("Input Validation", () => {
    it("should return 400 for invalid JSON", async () => {
      const req = new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          Origin: "http://localhost:5173",
        },
        body: "invalid-json-body",
      });
      const res = await worker.fetch(req, env, mockCtx as any);
      expect(res.status).toBe(400);
    });

    it("should return 400 for empty or invalid messages format", async () => {
      const req = new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          Origin: "http://localhost:5173",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: "not-an-array" }),
      });
      const res = await worker.fetch(req, env, mockCtx as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("messaggi non validi");
    });
  });

  describe("Vault access", () => {
    it("should block vault access without token", async () => {
      const req = new Request("http://localhost/api/vault", { method: "GET" });
      const res = await worker.fetch(req, env, mockCtx as any);
      expect(res.status).toBe(401);
    });

    it("should block vault access with incorrect token", async () => {
      const req = new Request("http://localhost/api/vault", {
        method: "GET",
        headers: { Authorization: "Bearer wrong-token" },
      });
      const res = await worker.fetch(req, env, mockCtx as any);
      expect(res.status).toBe(401);
    });

    it("should allow vault access with correct token", async () => {
      // Populate logs
      mockKV.store.set("log:2026-06-20T12:00:00.000Z:visitor-1", JSON.stringify({
        ts: "2026-06-20T12:00:00.000Z",
        user: "Hi",
        whychat: "Hello",
      }));

      const req = new Request("http://localhost/api/vault", {
        method: "GET",
        headers: { Authorization: "Bearer mock-admin-token" },
      });
      const res = await worker.fetch(req, env, mockCtx as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.count).toBe(1);
      expect(data.entries[0].user).toBe("Hi");
    });
  });

  describe("Flights endpoint", () => {
    it("should fetch real flight data from OpenSky (positions + live)", async () => {
      // formato OpenSky /states/all: array per stato, indici fissi
      // [icao24, callsign, country, t_pos, last, lon(5), lat(6), alt, on_ground(8), vel(9), track(10), ...]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          states: [
            ["abc", "AZA123 ", "Italy", 0, 0, 9.2, 45.1, 9000, false, 230, 90, 0],
            ["def", "DLH456 ", "Germany", 0, 0, 15.3, 40.5, 11000, false, 250, 180, 0],
            ["ghi", "GRD789 ", "Spain", 0, 0, 12.0, 41.0, 0, true, 0, 0, 0], // a terra → escluso
            ["jkl", "NUL000 ", "x", 0, 0, null, 12.0, 0, false, 0, 0, 0], // senza lon → escluso
          ],
        }),
      });

      const req = new Request("http://localhost/api/flights", { method: "GET" });
      const res = await worker.fetch(req, env, mockCtx as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.flights).toEqual([
        [9.2, 45.1],
        [15.3, 40.5],
      ]);
      expect(data.live).toHaveLength(2);
      expect(data.live[0]).toMatchObject({ lon: 9.2, lat: 45.1, dir: 90, spd: 230, call: "AZA123" });
    });
  });
});
