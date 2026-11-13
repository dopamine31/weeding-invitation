import { db } from "../src/db";
import { sql } from "drizzle-orm";

// Touch db lazily so the pool exists, then expose a closer for CLI scripts.
export const pool = {
  async end() {
    await db.execute(sql`select 1`);
    const g = globalThis as typeof globalThis & { __wosPool?: { end: () => Promise<void> } };
    await g.__wosPool?.end();
  },
};
