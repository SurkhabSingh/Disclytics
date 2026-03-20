CREATE TABLE IF NOT EXISTS users (
  discord_user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  global_name TEXT,
  avatar TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guilds (
  discord_guild_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  bot_present BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_guilds (
  discord_user_id TEXT NOT NULL REFERENCES users(discord_user_id) ON DELETE CASCADE,
  discord_guild_id TEXT NOT NULL REFERENCES guilds(discord_guild_id) ON DELETE CASCADE,
  permissions BIGINT,
  joined_via_oauth_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (discord_user_id, discord_guild_id)
);

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  discord_user_id TEXT NOT NULL REFERENCES users(discord_user_id) ON DELETE CASCADE,
  discord_guild_id TEXT NOT NULL REFERENCES guilds(discord_guild_id) ON DELETE CASCADE,
  discord_channel_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('message', 'voice_join', 'voice_leave', 'voice_switch')),
  occurred_at TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE TABLE IF NOT EXISTS voice_sessions (
  id BIGSERIAL PRIMARY KEY,
  discord_user_id TEXT NOT NULL REFERENCES users(discord_user_id) ON DELETE CASCADE,
  discord_guild_id TEXT NOT NULL REFERENCES guilds(discord_guild_id) ON DELETE CASCADE,
  discord_channel_id TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  closed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_stats (
  discord_user_id TEXT NOT NULL REFERENCES users(discord_user_id) ON DELETE CASCADE,
  discord_guild_id TEXT NOT NULL REFERENCES guilds(discord_guild_id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  total_voice_seconds INTEGER NOT NULL DEFAULT 0,
  total_messages INTEGER NOT NULL DEFAULT 0,
  active_channels JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (discord_user_id, discord_guild_id, stat_date)
);

CREATE TABLE IF NOT EXISTS reminders (
  id BIGSERIAL PRIMARY KEY,
  discord_user_id TEXT NOT NULL REFERENCES users(discord_user_id) ON DELETE CASCADE,
  discord_guild_id TEXT REFERENCES guilds(discord_guild_id) ON DELETE SET NULL,
  target_channel_id TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('once', 'daily', 'weekly')),
  schedule_time TIME NOT NULL,
  schedule_date DATE,
  schedule_days SMALLINT[] NOT NULL DEFAULT '{}'::SMALLINT[],
  timezone TEXT NOT NULL DEFAULT 'UTC',
  delivery_modes TEXT[] NOT NULL DEFAULT ARRAY['dm']::TEXT[],
  next_run_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user_time
  ON events (discord_user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_guild_time
  ON events (discord_guild_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_user_channel
  ON events (discord_user_id, discord_channel_id);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_start
  ON voice_sessions (discord_user_id, start_time DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_voice_sessions_open
  ON voice_sessions (discord_user_id, discord_guild_id)
  WHERE end_time IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_voice_sessions_start
  ON voice_sessions (discord_user_id, discord_guild_id, start_time);

CREATE INDEX IF NOT EXISTS idx_reminders_due
  ON reminders (active, next_run_at)
  WHERE active = TRUE AND next_run_at IS NOT NULL;
