import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

function isPlaceholderConnectionString(value) {
  return !value || /^replace-|^YOUR_|example\.com|your-domain/i.test(String(value));
}

async function main() {
  const connectionString = process.env.MIRAGE_POSTGRES_URL || process.env.DATABASE_URL;
  if (isPlaceholderConnectionString(connectionString)) {
    throw new Error("MIRAGE_POSTGRES_URL or DATABASE_URL must point to the production PostgreSQL database");
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.resolve(__dirname, "../../docs/POSTGRES_SCHEMA.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: Number(process.env.MIRAGE_POSTGRES_CONNECT_TIMEOUT_MS || 10_000),
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(schema);
    await client.query("COMMIT");
    console.log("postgres migration applied: docs/POSTGRES_SCHEMA.sql");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
