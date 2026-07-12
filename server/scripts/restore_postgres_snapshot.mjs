import fs from "node:fs";
import path from "node:path";

function placeholder(value) {
  return !value || /^replace-|^YOUR_|example\.com|your-domain/i.test(String(value));
}

function resolveBackupPath() {
  const value = process.argv[2] || process.env.MIRAGE_BACKUP_PATH;
  if (!value) {
    throw new Error("MIRAGE_BACKUP_PATH or backup file argument is required");
  }
  return path.resolve(value);
}

function readBackup(filePath) {
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (payload.format !== "mirage-state-snapshot-v1" || payload.id !== "main" || !payload.state) {
    throw new Error("invalid Mirage snapshot backup file");
  }
  return payload;
}

async function main() {
  const connectionString = process.env.MIRAGE_POSTGRES_URL || process.env.DATABASE_URL;
  if (placeholder(connectionString)) {
    throw new Error("MIRAGE_POSTGRES_URL or DATABASE_URL must point to the production PostgreSQL database");
  }
  const backupPath = resolveBackupPath();
  const payload = readBackup(backupPath);
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: Number(process.env.MIRAGE_POSTGRES_CONNECT_TIMEOUT_MS || 10_000),
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["mirage_state_snapshot_main"]);
    await client.query(
      `INSERT INTO state_snapshots (id, state_json, updated_at)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT(id) DO UPDATE SET
         state_json = excluded.state_json,
         updated_at = excluded.updated_at`,
      ["main", JSON.stringify(payload.state), new Date().toISOString()],
    );
    await client.query("COMMIT");
    console.log(`postgres snapshot restored: ${backupPath}`);
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
