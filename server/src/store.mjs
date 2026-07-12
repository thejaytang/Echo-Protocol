import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const initialState = {
  users: [],
  matchmaking: [],
  rooms: [],
  games: [],
  reports: [],
  blocks: [],
  missionClaims: [],
  topicSettings: {},
  events: [],
};

export class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = structuredClone(initialState);
    this.load();
  }

  load() {
    if (!this.filePath || !fs.existsSync(this.filePath)) return;
    const raw = fs.readFileSync(this.filePath, "utf8");
    if (!raw.trim()) return;
    this.state = { ...structuredClone(initialState), ...JSON.parse(raw) };
  }

  save() {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }

  snapshot() {
    return this.state;
  }

  mutate(mutator) {
    const result = mutator(this.state);
    this.save();
    return result;
  }
}

export class MemoryStore extends JsonStore {
  constructor() {
    super(null);
  }
}

export class SQLiteStore extends JsonStore {
  constructor(filePath) {
    super(null);
    this.filePath = filePath;
    const require = createRequire(import.meta.url);
    const { DatabaseSync } = require("node:sqlite");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.database = new DatabaseSync(filePath);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    this.load();
  }

  load() {
    if (!this.database) return;
    const row = this.database.prepare("SELECT state_json FROM snapshots WHERE id = ?").get("main");
    if (!row?.state_json) return;
    this.state = { ...structuredClone(initialState), ...JSON.parse(row.state_json) };
  }

  save() {
    if (!this.database) return;
    this.database
      .prepare(
        `INSERT INTO snapshots (id, state_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           state_json = excluded.state_json,
           updated_at = excluded.updated_at`,
      )
      .run("main", JSON.stringify(this.state), new Date().toISOString());
  }
}

export class PostgresStore extends JsonStore {
  constructor({ connectionString } = {}) {
    super(null);
    this.connectionString = connectionString;
    this.pool = null;
  }

  async init() {
    if (!this.connectionString) {
      throw new Error("MIRAGE_POSTGRES_URL or DATABASE_URL is required when MIRAGE_STORE=postgres");
    }
    const { Pool } = await import("pg");
    this.pool = new Pool({ connectionString: this.connectionString });
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS state_snapshots (
        id TEXT PRIMARY KEY,
        state_json JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);
    await this.load();
    return this;
  }

  async load() {
    if (!this.pool) return;
    const result = await this.pool.query("SELECT state_json FROM state_snapshots WHERE id = $1", ["main"]);
    const stateJson = result.rows[0]?.state_json;
    if (!stateJson) return;
    this.state = {
      ...structuredClone(initialState),
      ...(typeof stateJson === "string" ? JSON.parse(stateJson) : stateJson),
    };
  }

  async snapshot() {
    await this.load();
    return this.state;
  }

  async mutate(mutator) {
    if (!this.pool) {
      throw new Error("postgres_store_not_initialized");
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["mirage_state_snapshot_main"]);
      const result = await client.query("SELECT state_json FROM state_snapshots WHERE id = $1 FOR UPDATE", ["main"]);
      const stateJson = result.rows[0]?.state_json;
      const state = stateJson
        ? { ...structuredClone(initialState), ...(typeof stateJson === "string" ? JSON.parse(stateJson) : stateJson) }
        : structuredClone(initialState);
      const output = mutator(state);
      await client.query(
        `INSERT INTO state_snapshots (id, state_json, updated_at)
         VALUES ($1, $2::jsonb, $3)
         ON CONFLICT(id) DO UPDATE SET
           state_json = excluded.state_json,
           updated_at = excluded.updated_at`,
        ["main", JSON.stringify(state), new Date().toISOString()],
      );
      await client.query("COMMIT");
      this.state = state;
      return output;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool?.end();
  }
}
