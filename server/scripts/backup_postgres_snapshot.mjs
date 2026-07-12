import fs from "node:fs";
import path from "node:path";

function placeholder(value) {
  return !value || /^replace-|^YOUR_|example\.com|your-domain/i.test(String(value));
}

function defaultBackupPath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve("backups", `mirage-state-${stamp}.json`);
}

async function main() {
  const connectionString = process.env.MIRAGE_POSTGRES_URL || process.env.DATABASE_URL;
  if (placeholder(connectionString)) {
    throw new Error("MIRAGE_POSTGRES_URL or DATABASE_URL must point to the production PostgreSQL database");
  }
  const backupPath = path.resolve(process.env.MIRAGE_BACKUP_PATH || defaultBackupPath());
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: Number(process.env.MIRAGE_POSTGRES_CONNECT_TIMEOUT_MS || 10_000),
  });
  try {
    const result = await pool.query("SELECT state_json, updated_at FROM state_snapshots WHERE id = $1", ["main"]);
    const row = result.rows[0];
    if (!row?.state_json) {
      throw new Error("state_snapshots main row not found");
    }
    const payload = {
      format: "mirage-state-snapshot-v1",
      id: "main",
      exportedAt: new Date().toISOString(),
      snapshotUpdatedAt: row.updated_at,
      state: typeof row.state_json === "string" ? JSON.parse(row.state_json) : row.state_json,
    };
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.writeFileSync(backupPath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    console.log(`postgres snapshot backup written: ${backupPath}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
