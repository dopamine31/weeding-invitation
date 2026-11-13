import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Lazy initialisation: importing this module never touches the database,
// so `next build` works without a running Postgres.
const g = globalThis as typeof globalThis & { __wosPool?: Pool; __wosDb?: NodePgDatabase<typeof schema> };

function getDb(): NodePgDatabase<typeof schema> {
  if (!g.__wosDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is required");
    g.__wosPool = new Pool({ connectionString: url, max: 10 });
    g.__wosDb = drizzle(g.__wosPool, { schema });
  }
  return g.__wosDb;
}

export const db: NodePgDatabase<typeof schema> = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

export { schema };
