const ACTIVE_VOICE_STALE_GRACE_SECONDS = 90;

function getEffectiveVoiceEndSql(alias = "", fallbackSql = "NOW()") {
  const prefix = alias ? `${alias}.` : "";

  return `COALESCE(${prefix}end_time, LEAST(${fallbackSql}, ${prefix}updated_at + INTERVAL '${ACTIVE_VOICE_STALE_GRACE_SECONDS} seconds'))`;
}

module.exports = {
  ACTIVE_VOICE_STALE_GRACE_SECONDS,
  getEffectiveVoiceEndSql
};
