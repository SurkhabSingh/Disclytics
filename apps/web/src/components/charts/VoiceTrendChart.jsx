import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(Number(seconds || 0)));
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${remainingMinutes} min`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

function formatDayLabel(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function getSafeUpperBound(dataKey) {
  return (dataMax) => {
    const numericMax = Number(dataMax || 0);

    if (dataKey === "messages") {
      return Math.max(Math.ceil(numericMax * 1.25), 5);
    }

    return Math.max(Math.ceil((numericMax * 1.25) / 1800) * 1800, 1800);
  };
}

export function VoiceTrendChart({ data }) {
  const chartData = (data || []).map((item) => ({
    ...item,
    fullDate: item.date,
    label: formatDayLabel(item.date),
    totalMessages: Number(item.totalMessages || 0),
    voiceSeconds: Number(item.totalVoiceSeconds || 0)
  }));
  const busiestDay = chartData.reduce((currentBest, item) => {
    const currentScore = (item.totalMessages || 0) + Math.round((item.voiceSeconds || 0) / 60);
    const bestScore = currentBest
      ? currentBest.totalMessages + Math.round((currentBest.voiceSeconds || 0) / 60)
      : -1;
    return currentScore > bestScore ? item : currentBest;
  }, null);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h3>Your last 7 days, in plain English</h3>
        </div>
      </div>
      <p className="chart-copy">
        Each bar shows messages sent that day. The line shows time spent in voice channels.
        {busiestDay ? ` Your busiest day was ${busiestDay.label}.` : ""}
      </p>
      <div className="chart-shell">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="label" />
            <YAxis
              yAxisId="left"
              allowDecimals={false}
              domain={[0, getSafeUpperBound("messages")]}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              allowDecimals={false}
              domain={[0, getSafeUpperBound("voice")]}
              tickFormatter={(value) => formatDuration(Number(value))}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--tooltip-bg)",
                border: "1px solid var(--tooltip-border)",
                borderRadius: "10px",
                color: "var(--tooltip-text)"
              }}
              formatter={(value, name) => {
                if (name === "Voice time") {
                  return [formatDuration(Number(value)), name];
                }

                return [`${value} messages`, name];
              }}
              itemStyle={{ color: "var(--tooltip-text)" }}
              labelFormatter={(_, payload) => {
                const rawDate = payload?.[0]?.payload?.fullDate;
                const label = rawDate
                  ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(rawDate))
                  : "";
                return label ? `On ${label}` : "";
              }}
              labelStyle={{ color: "var(--tooltip-text)" }}
              wrapperStyle={{ outline: "none" }}
            />
            <Bar
              yAxisId="left"
              dataKey="totalMessages"
              name="Messages sent"
              fill="var(--chart-bar)"
              radius={[6, 6, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="linear"
              dataKey="voiceSeconds"
              name="Voice time"
              stroke="var(--chart-line)"
              strokeWidth={3}
              dot={{ r: 3, fill: "var(--chart-line)" }}
              activeDot={{ r: 5, fill: "var(--chart-line)" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
