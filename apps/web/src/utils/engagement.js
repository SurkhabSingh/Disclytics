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
