// Tipi minimi per l'ambiente Cloudflare Workers usati da WhyChat.
// (Evita la dipendenza pesante da @cloudflare/workers-types per il build statico.)

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number; expiration?: number },
  ): Promise<void>;
  list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
