type PagesFunction<Env = unknown> = (context: {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
  next: () => Promise<Response>;
  params: Record<string, string>;
  data: Record<string, unknown>;
}) => Response | Promise<Response>;

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, value: ArrayBuffer | Uint8Array | string, options?: R2PutOptions): Promise<unknown>;
  delete(key: string): Promise<void>;
}

interface R2ObjectBody {
  body: ReadableStream;
  httpMetadata?: {
    contentType?: string;
  };
}

interface R2PutOptions {
  httpMetadata?: {
    contentType?: string;
  };
}
