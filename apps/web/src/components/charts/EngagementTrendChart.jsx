import { memo, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import {
  formatLocalCalendarDate,
  formatVoiceAxisDuration,
  formatVoiceDuration
} from "../../utils/engagement";

function TrendTooltip({ active, metric, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0].payload;
  const label = formatLocalCalendarDate(point.date, { dateStyle: "medium" });
  const value = metric === "voice"
    ? formatVoiceDuration(point.totalVoiceSeconds)
    : `${point.totalMessages} messages`;

  return (
    <div className="chart-tooltip-card">
      <p className="chart-tooltip-title">{label}</p>
      <p className="chart-tooltip-line">{value}</p>
    </div>
  );
}

export const EngagementTrendChart = memo(function EngagementTrendChart({ data, trackedStartDate }) {
  const [metric, setMetric] = useState("messages");
  const chartData = useMemo(
    () => (data || []).map((item) => ({
      ...item,
      label: formatLocalCalendarDate(item.date, {
        month: "short",
        day: "numeric"
      })
    })),
    [data]
  );

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Trend</p>
          <p className="panel-title">
            {trackedStartDate
              ? `Your activity trend since ${trackedStartDate}`
              : "Your activity trend"}
          </p>
        </div>
        <div className="tab-row trend-toggle-row">
          <button
            className={`tab-button ${metric === "messages" ? "tab-button-active" : ""}`}
            onClick={() => setMetric("messages")}
            type="button"
          >
            Messages
          </button>
          <button
            className={`tab-button ${metric === "voice" ? "tab-button-active" : ""}`}
            onClick={() => setMetric("voice")}
            type="button"
          >
            Voice time
          </button>
        </div>
      </div>
      <p className="chart-copy">
        Switch between messages and voice time to compare your activity day by day in your local timezone.
      </p>
      <div className="chart-shell">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 10, right: 12, bottom: 8, left: 4 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis dataKey="label" minTickGap={24} />
            <YAxis
              allowDecimals={false}
              tickFormatter={(value) => (
                metric === "voice"
                  ? formatVoiceAxisDuration(value)
                  : value
              )}
            />
            <Tooltip
              content={<TrendTooltip metric={metric} />}
              wrapperStyle={{ outline: "none" }}
            />
            <Line
              activeDot={{ r: 5, fill: metric === "voice" ? "var(--chart-line)" : "var(--chart-bar)" }}
              dataKey={metric === "voice" ? "totalVoiceSeconds" : "totalMessages"}
              dot={false}
              name={metric === "voice" ? "Voice time" : "Messages"}
              stroke={metric === "voice" ? "var(--chart-line)" : "var(--chart-bar)"}
              strokeWidth={3}
              type="linear"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
});
