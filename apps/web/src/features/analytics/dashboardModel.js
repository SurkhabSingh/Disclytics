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

function normalizePeerPoint(row) {
  return {
    userId: asOptionalText(row?.userId),
    displayName: asOptionalText(row?.displayName) || "Unknown user",
    totalMessages: asNonNegativeNumber(row?.totalMessages),
    totalVoiceSeconds: asNonNegativeNumber(row?.totalVoiceSeconds),
    avgMessagesPerDay: asNonNegativeNumber(row?.avgMessagesPerDay),
    avgVoiceSecondsPerDay: asNonNegativeNumber(row?.avgVoiceSecondsPerDay),
    recentTotalMessages: asNonNegativeNumber(row?.recentTotalMessages),
    recentTotalVoiceSeconds: asNonNegativeNumber(row?.recentTotalVoiceSeconds),
    isCurrentUser: Boolean(row?.isCurrentUser)
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
    comparison: options.includeComparison
      ? {
        trackedDayCount: asNonNegativeNumber(scope?.comparison?.trackedDayCount),
        recentWindowDays: asNonNegativeNumber(scope?.comparison?.recentWindowDays),
        peers: {
          lifetime: asArray(scope?.comparison?.peers?.lifetime).map(normalizePeerPoint),
          daily: asArray(scope?.comparison?.peers?.daily).map(normalizePeerPoint)
        }
      }
      : null,
    leaderboards: {
      chatChannels: asArray(scope?.leaderboards?.chatChannels).map((row) => normalizeLeaderboardItem(row, false)),
      voiceChannels: asArray(scope?.leaderboards?.voiceChannels).map((row) => normalizeLeaderboardItem(row, true))
    },
    recentMessages: asArray(scope?.recentMessages).map(normalizeMessageItem),
    recentVoiceSessions: asArray(scope?.recentVoiceSessions).map(normalizeVoiceSession)
  };
}

export function normalizeDashboardPayload(payload) {
  const todayDate = asOptionalText(payload?.todayDate) || new Date().toISOString().slice(0, 10);
  const trackedRange = {
    firstActivityDate: asOptionalText(payload?.trackedRange?.firstActivityDate),
    lastActivityDate: asOptionalText(payload?.trackedRange?.lastActivityDate)
  };
  const today = normalizeScope(payload?.scopes?.today, { includeHourly: true });
  const history = normalizeScope(payload?.scopes?.history, { includeHourly: true });
  const lifetime = normalizeScope(payload?.scopes?.lifetime, {
    includeComparison: true,
    includeTrend: true
  });
  const availableDates = asArray(payload?.availableDates).filter((value) => typeof value === "string");
  const selectedDate = asOptionalText(payload?.selectedDate) || availableDates[0] || trackedRange.lastActivityDate || todayDate;

  return {
    availableDates,
    coverage: {
      accessibleGuilds: asNonNegativeNumber(payload?.coverage?.accessibleGuilds),
      trackedGuilds: asNonNegativeNumber(payload?.coverage?.trackedGuilds),
      percent: asNonNegativeNumber(payload?.coverage?.percent)
    },
    heatmap: asArray(payload?.heatmap).map((row) => ({
      dayOfWeek: asNonNegativeNumber(row?.dayOfWeek),
      hourOfDay: asNonNegativeNumber(row?.hourOfDay),
      eventCount: asNonNegativeNumber(row?.eventCount)
    })),
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
    todayDate,
    trackedRange
  };
}

function applyScopeLiveVoice(scope, elapsedSeconds, options = {}) {
  if (!scope || elapsedSeconds <= 0) {
    return scope;
  }

  const activeSessions = asArray(scope.recentVoiceSessions).filter((session) => !session.endTime);

  if (!activeSessions.length) {
    return scope;
  }

  const liveExtraSeconds = activeSessions.length * elapsedSeconds;
  const nextScope = {
    ...scope,
    summary: {
      ...scope.summary,
      totalVoiceSeconds: asNonNegativeNumber(scope.summary?.totalVoiceSeconds) + liveExtraSeconds
    },
    recentVoiceSessions: asArray(scope.recentVoiceSessions).map((session) => (
      session.endTime
        ? session
        : {
          ...session,
          durationSeconds: asNonNegativeNumber(session.durationSeconds) + elapsedSeconds
        }
    ))
  };

  if (Array.isArray(scope.trend)) {
    nextScope.trend = scope.trend.map((item, index, items) => (
      index === items.length - 1
        ? {
          ...item,
          totalVoiceSeconds: asNonNegativeNumber(item.totalVoiceSeconds) + liveExtraSeconds
        }
        : item
    ));
  }

  if (Array.isArray(scope.hourlyBreakdown) && typeof options.currentHour === "number") {
    nextScope.hourlyBreakdown = scope.hourlyBreakdown.map((item) => (
      item.hourOfDay === options.currentHour
        ? {
          ...item,
          totalVoiceSeconds: asNonNegativeNumber(item.totalVoiceSeconds) + liveExtraSeconds
        }
        : item
    ));
  }

  return nextScope;
}

export function applyLiveVoiceProgress(dashboard, lastUpdatedAt, nowTimestamp) {
  if (!dashboard || !lastUpdatedAt) {
    return dashboard;
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((nowTimestamp - new Date(lastUpdatedAt).getTime()) / 1000)
  );

  if (elapsedSeconds <= 0) {
    return dashboard;
  }

  const currentUtcDate = new Date(nowTimestamp).toISOString().slice(0, 10);
  const currentUtcHour = new Date(nowTimestamp).getUTCHours();

  return {
    ...dashboard,
    scopes: {
      today: applyScopeLiveVoice(dashboard.scopes?.today, elapsedSeconds, {
        currentHour: currentUtcHour
      }),
      history: dashboard.selectedDate === currentUtcDate
        ? applyScopeLiveVoice(dashboard.scopes?.history, elapsedSeconds, {
          currentHour: currentUtcHour
        })
        : dashboard.scopes?.history,
      lifetime: applyScopeLiveVoice(dashboard.scopes?.lifetime, elapsedSeconds)
    }
  };
}
