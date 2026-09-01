import fs from "fs";
import path from "path";

const migrationsDir = path.join(process.cwd(), "drizzle", "migrations");
const files = fs.readdirSync(migrationsDir);

for (const file of files) {
  if (file.endsWith(".sql") && file !== "0000_initial_schema.sql") {
    const fullPath = path.join(migrationsDir, file);
    fs.unlinkSync(fullPath);
    console.log(`Deleted old migration file: ${file}`);
  }
}
console.log("Migration directory cleaned successfully!");
