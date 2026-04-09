export function formatVoiceDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(Number(seconds || 0)));
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} min`;
  }

  return `${hours}h ${minutes}m`;
}

export function formatVoiceAxisDuration(seconds) {
  const totalSeconds = Math.max(0, Number(seconds || 0));

  if (totalSeconds < 3600) {
    return `${Math.round(totalSeconds / 60)}m`;
  }

  const roundedHours = Math.round((totalSeconds / 3600) * 10) / 10;
  return `${roundedHours}h`;
}

export function calculateDailyAverages(summary, trackedDayCount) {
  const safeDayCount = Math.max(1, Number(trackedDayCount || 0));
  return {
    avgMessagesPerDay: Number(summary?.totalMessages || 0) / safeDayCount,
    avgVoiceSecondsPerDay: Number(summary?.totalVoiceSeconds || 0) / safeDayCount
  };
}

function createStableDateForDisplay(dateValue) {
  if (typeof dateValue !== "string") {
    return null;
  }

  const [year, month, day] = dateValue.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function formatLocalCalendarDate(dateValue, options) {
  const stableDate = createStableDateForDisplay(dateValue);
  if (!stableDate) {
    return dateValue || "";
  }

  return new Intl.DateTimeFormat(undefined, options).format(stableDate);
}
