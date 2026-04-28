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
  run(): Promise<unknown>;
}
