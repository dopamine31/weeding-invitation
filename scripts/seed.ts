import "dotenv/config";
import { seedDemo, DEMO_EMAIL, DEMO_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD } from "../src/server/seed";
import { pool } from "./pool";

async function main() {
  await seedDemo({ force: process.argv.includes("--force") });
  console.log(`Seed OK. demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD} | admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
