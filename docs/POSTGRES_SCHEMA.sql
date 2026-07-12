CREATE TABLE IF NOT EXISTS state_snapshots (
  id TEXT PRIMARY KEY,
  state_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('guest', 'apple', 'google', 'wechat')),
  nickname TEXT NOT NULL,
  avatar_key TEXT,
  apple_sub TEXT UNIQUE,
  google_sub TEXT UNIQUE,
  wechat_sub TEXT UNIQUE,
  wechat_union_id TEXT,
  apple_refresh_token TEXT,
  email TEXT,
  banned_at TIMESTAMPTZ,
  ban_reason TEXT,
  age_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
  community_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  invite_code TEXT NOT NULL UNIQUE,
  mode_id TEXT NOT NULL,
  host_user_id TEXT REFERENCES users(id),
  allow_ai_fill BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL,
  game_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS room_players (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  user_id TEXT REFERENCES users(id),
  nickname TEXT NOT NULL,
  kind TEXT NOT NULL,
  ready BOOLEAN NOT NULL DEFAULT FALSE,
  role TEXT NOT NULL,
  persona TEXT,
  hidden_task TEXT
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  room_id TEXT REFERENCES rooms(id),
  mode_id TEXT NOT NULL,
  topic JSONB NOT NULL,
  phase TEXT NOT NULL,
  phase_ends_at TIMESTAMPTZ,
  winner TEXT,
  replay JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS game_players (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  user_id TEXT REFERENCES users(id),
  nickname TEXT NOT NULL,
  kind TEXT NOT NULL,
  ready BOOLEAN NOT NULL,
  role TEXT NOT NULL,
  persona TEXT,
  hidden_task TEXT,
  strategy_tags JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  sender_kind TEXT NOT NULL,
  sender_player_id TEXT REFERENCES game_players(id),
  text TEXT NOT NULL,
  status TEXT NOT NULL,
  strategy_tag TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  voter_player_id TEXT NOT NULL REFERENCES game_players(id),
  target_player_id TEXT NOT NULL,
  confidence TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (game_id, user_id)
);

CREATE TABLE IF NOT EXISTS suspicions (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  target_player_id TEXT NOT NULL REFERENCES game_players(id),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  reason TEXT NOT NULL DEFAULT 'detail_gap',
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (game_id, user_id, target_player_id)
);

CREATE TABLE IF NOT EXISTS mid_checks (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  player_id TEXT NOT NULL REFERENCES game_players(id),
  target_player_id TEXT NOT NULL REFERENCES game_players(id),
  reason TEXT NOT NULL DEFAULT 'detail_gap',
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (game_id, user_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT NOT NULL REFERENCES users(id),
  target_user_id TEXT REFERENCES users(id),
  room_id TEXT REFERENCES rooms(id),
  game_id TEXT REFERENCES games(id),
  message_id TEXT REFERENCES messages(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  action TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  source_user_id TEXT NOT NULL REFERENCES users(id),
  target_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (source_user_id, target_user_id)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_games_phase ON games (phase);
CREATE INDEX IF NOT EXISTS idx_messages_game_created ON messages (game_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports (status, created_at);
CREATE INDEX IF NOT EXISTS idx_events_type_created ON events (type, created_at);
