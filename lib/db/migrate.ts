import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./index";
import { sql } from "drizzle-orm";

export async function runMigrations(forceReset = false) {
  console.log("Running Drizzle ORM migrations from ./drizzle/migrations...");

  if (forceReset) {
    console.log("Resetting Drizzle migration tracking table __drizzle_migrations...");
    await db.execute(sql`DROP TABLE IF EXISTS "drizzle"."__drizzle_migrations" CASCADE;`);
  }

  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  console.log("✅ Drizzle ORM migrations completed successfully!");
}

if (require.main === module) {
  runMigrations(true)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Migration failed:", err);
      process.exit(1);
    });
}
