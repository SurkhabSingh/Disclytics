function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNonNegativeNumber(value) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return numericValue;
}

function asOptionalText(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function isSafeHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeSummary(summary) {
  return {
    totalMessages: asNonNegativeNumber(summary?.totalMessages),
    totalVoiceSeconds: asNonNegativeNumber(summary?.totalVoiceSeconds),
    mostActiveChannelId: asOptionalText(summary?.mostActiveChannelId),
    mostActiveChannelName: asOptionalText(summary?.mostActiveChannelName),
    mostActiveChannelCount: asNonNegativeNumber(summary?.mostActiveChannelCount)
  };
}

function normalizeLeaderboardItem(row, voiceMode = false) {
  return {
    channelId: asOptionalText(row?.channelId),
    channelName: asOptionalText(row?.channelName),
    ...(voiceMode
      ? { totalVoiceSeconds: asNonNegativeNumber(row?.totalVoiceSeconds) }
      : { messageCount: asNonNegativeNumber(row?.messageCount) })
  };
}

function normalizeMediaItem(item) {
  if (!isSafeHttpUrl(item?.url)) {
    return null;
  }

  return {
    url: item.url,
    kind: item?.kind === "video" ? "video" : (item?.kind === "gif" ? "gif" : "image"),
    label: asOptionalText(item?.label)
  };
}

function normalizeMessageItem(row) {
  return {
    channelId: asOptionalText(row?.channelId),
    channelName: asOptionalText(row?.channelName),
    content: typeof row?.content === "string" ? row.content : null,
    media: asArray(row?.media).map(normalizeMediaItem).filter(Boolean),
    occurredAt: asOptionalText(row?.occurredAt)
  };
}

function normalizeVoiceSession(row) {
  return {
    channelId: asOptionalText(row?.channelId),
    channelName: asOptionalText(row?.channelName),
    startTime: asOptionalText(row?.startTime),
    endTime: asOptionalText(row?.endTime),
    durationSeconds: asNonNegativeNumber(row?.durationSeconds),
    closedReason: asOptionalText(row?.closedReason)
  };
}

function normalizeTrendPoint(row) {
  return {
    date: asOptionalText(row?.date),
    totalMessages: asNonNegativeNumber(row?.totalMessages),
    totalVoiceSeconds: asNonNegativeNumber(row?.totalVoiceSeconds)
  };
}

function normalizeHourlyPoint(row) {
  return {
    hourOfDay: asNonNegativeNumber(row?.hourOfDay),
    totalMessages: asNonNegativeNumber(row?.totalMessages),
    totalVoiceSeconds: asNonNegativeNumber(row?.totalVoiceSeconds)
  };
}

function normalizeScope(scope, options = {}) {
  return {
    date: asOptionalText(scope?.date),
    summary: normalizeSummary(scope?.summary),
    trend: options.includeTrend ? asArray(scope?.trend).map(normalizeTrendPoint).filter((point) => point.date) : [],
    hourlyBreakdown: options.includeHourly
      ? asArray(scope?.hourlyBreakdown).map(normalizeHourlyPoint)
      : [],
    leaderboards: {
      chatChannels: asArray(scope?.leaderboards?.chatChannels).map((row) => normalizeLeaderboardItem(row, false)),
      voiceChannels: asArray(scope?.leaderboards?.voiceChannels).map((row) => normalizeLeaderboardItem(row, true))
    },
    recentMessages: asArray(scope?.recentMessages).map(normalizeMessageItem),
    recentVoiceSessions: asArray(scope?.recentVoiceSessions).map(normalizeVoiceSession),
    voiceSessionsForChart: asArray(scope?.voiceSessionsForChart).map(normalizeVoiceSession)
  };
}

function normalizeTrackedRange(trackedRange) {
  return {
    firstActivityDate: asOptionalText(trackedRange?.firstActivityDate),
    lastActivityDate: asOptionalText(trackedRange?.lastActivityDate)
  };
}

function normalizeCoverage(coverage) {
  return {
    accessibleGuilds: asNonNegativeNumber(coverage?.accessibleGuilds),
    trackedGuilds: asNonNegativeNumber(coverage?.trackedGuilds),
    percent: asNonNegativeNumber(coverage?.percent)
  };
}

function normalizeHeatmap(heatmap) {
  return asArray(heatmap).map((row) => ({
    dayOfWeek: asNonNegativeNumber(row?.dayOfWeek),
    hourOfDay: asNonNegativeNumber(row?.hourOfDay),
    eventCount: asNonNegativeNumber(row?.eventCount)
  }));
}

export function createEmptyScope() {
  return normalizeScope(null, { includeHourly: true, includeTrend: true });
}

export function normalizeOverviewPayload(payload) {
  const todayDate = asOptionalText(payload?.todayDate) || new Date().toISOString().slice(0, 10);
  const trackedRange = normalizeTrackedRange(payload?.trackedRange);
  const availableDates = asArray(payload?.availableDates).filter((value) => typeof value === "string");
  const selectedDate = asOptionalText(payload?.selectedDate) || availableDates[0] || trackedRange.lastActivityDate || todayDate;

  return {
    availableDates,
    coverage: normalizeCoverage(payload?.coverage),
    scopes: {
      today: {
        ...normalizeScope(payload?.scopes?.today, { includeHourly: true }),
        date: asOptionalText(payload?.scopes?.today?.date) || todayDate
      }
    },
    selectedDate,
    timezone: asOptionalText(payload?.timezone),
    todayDate,
    trackedRange
  };
}

export function normalizeHistoryPayload(payload) {
  return {
    availableDates: asArray(payload?.availableDates).filter((value) => typeof value === "string"),
    scopes: {
      history: {
        ...normalizeScope(payload?.scopes?.history, { includeHourly: true }),
        date: asOptionalText(payload?.scopes?.history?.date) || asOptionalText(payload?.selectedDate)
      }
    },
    selectedDate: asOptionalText(payload?.selectedDate),
    timezone: asOptionalText(payload?.timezone),
    todayDate: asOptionalText(payload?.todayDate),
    trackedRange: normalizeTrackedRange(payload?.trackedRange)
  };
}

export function normalizeLifetimePayload(payload) {
  return {
    heatmap: normalizeHeatmap(payload?.heatmap),
    scopes: {
      lifetime: normalizeScope(payload?.scopes?.lifetime, { includeTrend: true })
    },
    timezone: asOptionalText(payload?.timezone),
    todayDate: asOptionalText(payload?.todayDate),
    trackedRange: normalizeTrackedRange(payload?.trackedRange)
  };
}

export function normalizeDashboardPayload(payload) {
  const todayDate = asOptionalText(payload?.todayDate) || new Date().toISOString().slice(0, 10);
  const trackedRange = normalizeTrackedRange(payload?.trackedRange);
  const today = normalizeScope(payload?.scopes?.today, { includeHourly: true });
  const history = normalizeScope(payload?.scopes?.history, { includeHourly: true });
  const lifetime = normalizeScope(payload?.scopes?.lifetime, { includeTrend: true });
  const availableDates = asArray(payload?.availableDates).filter((value) => typeof value === "string");
  const selectedDate = asOptionalText(payload?.selectedDate) || availableDates[0] || trackedRange.lastActivityDate || todayDate;

  return {
    availableDates,
    coverage: normalizeCoverage(payload?.coverage),
    heatmap: normalizeHeatmap(payload?.heatmap),
    scopes: {
      history: {
        ...history,
        date: history.date || selectedDate
      },
      lifetime,
      today: {
        ...today,
        date: today.date || todayDate
      }
    },
    selectedDate,
    timezone: asOptionalText(payload?.timezone),
    todayDate,
    trackedRange
  };
}
