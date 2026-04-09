CREATE INDEX IF NOT EXISTS idx_daily_stats_stat_date
  ON daily_stats (stat_date);

CREATE INDEX IF NOT EXISTS idx_events_user_message_time
  ON events (discord_user_id, occurred_at DESC)
  WHERE type = 'message';

CREATE INDEX IF NOT EXISTS idx_events_user_voice_channel_time
  ON events (discord_user_id, discord_guild_id, discord_channel_id, occurred_at DESC)
  WHERE type IN ('voice_join', 'voice_leave', 'voice_switch');

CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_guild_start
  ON voice_sessions (discord_user_id, discord_guild_id, start_time DESC);
