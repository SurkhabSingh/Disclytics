import { memo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

function padHour(value) {
  return String(value).padStart(2, "0");
}

function formatHourLabel(hourOfDay) {
  return `${padHour(hourOfDay)}:00`;
}

function formatHourRange(hourOfDay) {
  return `${padHour(hourOfDay)}:00 - ${padHour(hourOfDay)}:59`;
}

function formatVoiceMinutes(value) {
  return `${Math.max(0, Math.round(Number(value || 0)))} min`;
}

function getSafeUpperBound(dataKey) {
  return (dataMax) => {
    const numericMax = Number(dataMax || 0);

    if (dataKey === "messages") {
      return Math.max(Math.ceil(numericMax * 1.15), 5);
    }

    return Math.max(Math.ceil((numericMax * 1.15) / 15) * 15, 15);
  };
}

function HourlyTooltip({ active, metricLabel, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0].payload;
  const value = metricLabel === "Voice time"
    ? formatVoiceMinutes(point.voiceMinutes)
    : `${point.totalMessages} messages`;

  return (
    <div className="chart-tooltip-card">
      <p className="chart-tooltip-title">{point.hourRangeLabel}</p>
      <p className="chart-tooltip-line">{value}</p>
    </div>
  );
}

export const HourlyUsageChart = memo(function HourlyUsageChart({
  data,
  selectedDate,
}) {
  const chartData = (data || []).map((item) => ({
    ...item,
    hourLabel: formatHourLabel(item.hourOfDay),
    hourRangeLabel: formatHourRange(item.hourOfDay),
    totalMessages: Number(item.totalMessages || 0),
    voiceMinutes: Math.round(Math.max(0, Number(item.totalVoiceSeconds || 0)) / 60),
  }));

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Day View</p>
          <p className="panel-title">
            {selectedDate
              ? `Local hourly activity for ${selectedDate}`
              : "Local hourly activity"}
          </p>
        </div>
      </div>

      <div className="chart-stack">
        <section className="chart-block">
          <div className="chart-block-header">
            <div>
              <p className="chart-block-kicker">Messages per hour</p>
            </div>
          </div>
          <div className="chart-shell chart-shell-compact">
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--chart-grid)"
                />
                <XAxis
                  dataKey="hourOfDay"
                  ticks={[0, 4, 8, 12, 16, 20]}
                  tickFormatter={formatHourLabel}
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, getSafeUpperBound("messages")]}
                />
                <Tooltip
                  content={<HourlyTooltip metricLabel="Messages" />}
                  wrapperStyle={{ outline: "none" }}
                />
                <Line
                  activeDot={{ r: 5, fill: "var(--chart-bar)" }}
                  dataKey="totalMessages"
                  dot={false}
                  name="Messages"
                  stroke="var(--chart-bar)"
                  strokeWidth={3}
                  type="linear"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="chart-block">
          <div className="chart-block-header">
            <div>
              <p className="chart-block-kicker">Voice minutes per hour</p>
            </div>
          </div>
          <div className="chart-shell chart-shell-compact">
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--chart-grid)"
                />
                <XAxis
                  dataKey="hourOfDay"
                  ticks={[0, 4, 8, 12, 16, 20]}
                  tickFormatter={formatHourLabel}
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, getSafeUpperBound("voice")]}
                  tickFormatter={formatVoiceMinutes}
                />
                <Tooltip
                  content={<HourlyTooltip metricLabel="Voice time" />}
                  wrapperStyle={{ outline: "none" }}
                />
                <Line
                  activeDot={{ r: 5, fill: "var(--chart-line)" }}
                  dataKey="voiceMinutes"
                  dot={false}
                  name="Voice time"
                  stroke="var(--chart-line)"
                  strokeWidth={3}
                  type="linear"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </section>
  );
});
