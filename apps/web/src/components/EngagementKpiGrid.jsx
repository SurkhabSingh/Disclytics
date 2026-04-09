import { memo } from "react";

import { MetricCard } from "./MetricCard";
import { calculateDailyAverages, formatVoiceDuration } from "../utils/engagement";

function formatAverageMessages(value) {
  return `${value.toFixed(value >= 100 ? 0 : 1)}/day`;
}

export const EngagementKpiGrid = memo(function EngagementKpiGrid({ summary, trackedDayCount, trackedStartDate }) {
  const safeTrackedDayCount = Number(trackedDayCount || 0);
  const averages = calculateDailyAverages(summary, safeTrackedDayCount);
  const dateDetail = trackedStartDate
    ? `Tracked since ${trackedStartDate}`
    : "Waiting for tracked activity";
  const dayDetail = safeTrackedDayCount
    ? `Average across ${safeTrackedDayCount} tracked day${safeTrackedDayCount === 1 ? "" : "s"}`
    : "Average will appear after activity is tracked";

  return (
    <section className="metric-grid engagement-kpi-grid">
      <MetricCard
        detail={dateDetail}
        label="Total messages"
        value={summary.totalMessages}
      />
      <MetricCard
        detail={dateDetail}
        label="Total voice time"
        value={formatVoiceDuration(summary.totalVoiceSeconds)}
      />
      <MetricCard
        detail={dayDetail}
        label="Avg messages per day"
        value={formatAverageMessages(averages.avgMessagesPerDay)}
      />
      <MetricCard
        detail={dayDetail}
        label="Avg voice per day"
        value={formatVoiceDuration(averages.avgVoiceSecondsPerDay)}
      />
    </section>
  );
});
