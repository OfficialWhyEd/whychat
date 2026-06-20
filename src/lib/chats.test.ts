import { describe, it, expect, beforeEach, vi } from "vitest";
import { newChatId, loadChats, saveChats, titleFrom, relativeTime, type Chat } from "./chats";

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) {
      return store[key] || null;
    },
    setItem(key: string, value: string) {
      store[key] = value.toString();
    },
    clear() {
      store = {};
    },
    removeItem(key: string) {
      delete store[key];
    },
  };
})();

Object.defineProperty(global, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

describe("chats.ts utilities", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("newChatId", () => {
    it("should generate a unique chat ID starting with c_", () => {
      const id1 = newChatId();
      const id2 = newChatId();
      expect(id1).toMatch(/^c_[a-z0-9]+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("loadChats", () => {
    it("should return empty array if localStorage has no chats", () => {
      const chats = loadChats();
      expect(chats).toEqual([]);
    });

    it("should parse and return chats from localStorage", () => {
      const mockChats: Chat[] = [
        {
          id: "1",
          title: "Test Chat",
          ts: Date.now(),
          messages: [{ id: "m1", role: "user", content: "Hello" }],
        },
      ];
      localStorage.setItem("whychat_chats_v1", JSON.stringify(mockChats));
      const loaded = loadChats();
      expect(loaded).toEqual(mockChats);
    });

    it("should return empty array if JSON is invalid", () => {
      localStorage.setItem("whychat_chats_v1", "invalid json");
      const loaded = loadChats();
      expect(loaded).toEqual([]);
    });

    it("should return empty array if stored data is not an array", () => {
      localStorage.setItem("whychat_chats_v1", JSON.stringify({ not: "an array" }));
      const loaded = loadChats();
      expect(loaded).toEqual([]);
    });
  });

  describe("saveChats", () => {
    it("should save clean chats to localStorage (cleaning streaming flag)", () => {
      const chats: Chat[] = [
        {
          id: "1",
          title: "Test Chat",
          ts: Date.now(),
          messages: [
            { id: "m1", role: "user", content: "Hello" },
            { id: "m2", role: "assistant", content: "Hi", streaming: true },
          ],
        },
      ];
      saveChats(chats);
      const savedStr = localStorage.getItem("whychat_chats_v1");
      expect(savedStr).toBeDefined();
      const saved = JSON.parse(savedStr!);
      // streaming flag should be dropped
      expect(saved[0].messages[1]).toEqual({ id: "m2", role: "assistant", content: "Hi" });
      expect(saved[0].messages[1].streaming).toBeUndefined();
    });

    it("should retain deep thinking thoughts in chats", () => {
      const chats: Chat[] = [
        {
          id: "1",
          title: "Deep Chat",
          ts: Date.now(),
          messages: [
            { id: "m1", role: "assistant", content: "Result", thoughts: "Thinking process" },
          ],
        },
      ];
      saveChats(chats);
      const saved = JSON.parse(localStorage.getItem("whychat_chats_v1")!);
      expect(saved[0].messages[0]).toEqual({
        id: "m1",
        role: "assistant",
        content: "Result",
        thoughts: "Thinking process",
      });
    });

    it("should slice and only save up to 50 chats", () => {
      const chats: Chat[] = Array.from({ length: 60 }, (_, i) => ({
        id: `c_${i}`,
        title: `Chat ${i}`,
        ts: Date.now(),
        messages: [],
      }));
      saveChats(chats);
      const saved = JSON.parse(localStorage.getItem("whychat_chats_v1")!);
      expect(saved.length).toBe(50);
      expect(saved[0].id).toBe("c_0");
      expect(saved[49].id).toBe("c_49");
    });
  });

  describe("titleFrom", () => {
    it("should format short title", () => {
      expect(titleFrom("Ciao come stai?")).toBe("Ciao come stai?");
    });

    it("should truncate long title and add ellipsis", () => {
      const longText = "Questo è un testo estremamente lungo che andrà sicuramente oltre i quarantasei caratteri previsti";
      const title = titleFrom(longText);
      expect(title.endsWith("…")).toBe(true);
      expect(title.length).toBe(47); // 46 chars + ellipsis
    });

    it("should return default title if text is empty", () => {
      expect(titleFrom("  ")).toBe("Nuova conversazione");
    });

    it("should collapse multiple whitespace into single space", () => {
      expect(titleFrom("Ciao   come   stai?")).toBe("Ciao come stai?");
    });
  });

  describe("relativeTime", () => {
    it("should return 'ora' for under 60 seconds", () => {
      const now = Date.now();
      expect(relativeTime(now - 10 * 1000)).toBe("ora");
    });

    it("should return minutes for under 1 hour", () => {
      const now = Date.now();
      expect(relativeTime(now - 10 * 60 * 1000)).toBe("10m");
    });

    it("should return hours for under 24 hours", () => {
      const now = Date.now();
      expect(relativeTime(now - 3 * 3600 * 1000)).toBe("3h");
    });

    it("should return days for under 7 days", () => {
      const now = Date.now();
      expect(relativeTime(now - 3 * 24 * 3600 * 1000)).toBe("3g");
    });

    it("should return formatted date for over 7 days", () => {
      // 10 days ago
      const ts = Date.now() - 10 * 24 * 3600 * 1000;
      const expected = new Date(ts).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
      expect(relativeTime(ts)).toBe(expected);
    });
  });
});
