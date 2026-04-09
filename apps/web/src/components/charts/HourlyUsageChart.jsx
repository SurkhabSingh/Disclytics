import { memo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatDuration(seconds) {
  const totalMinutes = Math.floor(Math.max(0, Number(seconds || 0)) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${remainingMinutes} min`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

function getSafeUpperBound(dataKey) {
  return (dataMax) => {
    const numericMax = Number(dataMax || 0);

    if (dataKey === "messages") {
      return Math.max(Math.ceil(numericMax * 1.2), 5);
    }

    return Math.max(Math.ceil((numericMax * 1.2) / 1800) * 1800, 1800);
  };
}

export const HourlyUsageChart = memo(function HourlyUsageChart({
  data,
  selectedDate,
}) {
  const chartData = (data || []).map((item) => ({
    ...item,
    displayHour: item.hourOfDay + 1,
    voiceSeconds: Number(item.totalVoiceSeconds || 0),
    totalMessages: Number(item.totalMessages || 0),
  }));

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Day View</p>
          <p className="panel-title">
            {selectedDate
              ? `Hourly activity for ${selectedDate}`
              : "Hourly activity"}
          </p>
        </div>
      </div>

      <div className="chart-stack">
        <section className="chart-block">
          <div className="chart-block-header">
            <div>
              <p className="chart-block-kicker">Messages</p>
            </div>
          </div>
          <div className="chart-shell chart-shell-compact">
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient
                    id="messageHourlyFill"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--chart-bar)"
                      stopOpacity={0.24}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-bar)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--chart-grid)"
                />
                <XAxis dataKey="displayHour" ticks={[4, 8, 12, 16, 20, 24]} />
                <YAxis
                  allowDecimals={false}
                  domain={[0, getSafeUpperBound("messages")]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--tooltip-bg)",
                    border: "1px solid var(--tooltip-border)",
                    borderRadius: "10px",
                    color: "var(--tooltip-text)",
                  }}
                  formatter={(value) => [`${value} messages`, "Messages"]}
                  itemStyle={{ color: "var(--tooltip-text)" }}
                  labelFormatter={(value) => `Hour ending ${value}:00`}
                  labelStyle={{ color: "var(--tooltip-text)" }}
                  wrapperStyle={{ outline: "none" }}
                />
                <Area
                  type="monotone"
                  dataKey="totalMessages"
                  name="Messages"
                  stroke="var(--chart-bar)"
                  strokeWidth={3}
                  fill="url(#messageHourlyFill)"
                  dot={false}
                  activeDot={{ r: 5, fill: "var(--chart-bar)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="chart-block">
          <div className="chart-block-header">
            <div>
              <p className="chart-block-kicker">Voice</p>
            </div>
          </div>
          <div className="chart-shell chart-shell-compact">
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient
                    id="voiceHourlyFill"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--chart-line)"
                      stopOpacity={0.28}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-line)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--chart-grid)"
                />
                <XAxis dataKey="displayHour" ticks={[4, 8, 12, 16, 20, 24]} />
                <YAxis
                  allowDecimals={false}
                  domain={[0, getSafeUpperBound("voice")]}
                  tickFormatter={(value) => formatDuration(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--tooltip-bg)",
                    border: "1px solid var(--tooltip-border)",
                    borderRadius: "10px",
                    color: "var(--tooltip-text)",
                  }}
                  formatter={(value) => [formatDuration(value), "Voice time"]}
                  itemStyle={{ color: "var(--tooltip-text)" }}
                  labelFormatter={(value) => `Hour ending ${value}:00`}
                  labelStyle={{ color: "var(--tooltip-text)" }}
                  wrapperStyle={{ outline: "none" }}
                />
                <Area
                  type="monotone"
                  dataKey="voiceSeconds"
                  name="Voice time"
                  stroke="var(--chart-line)"
                  strokeWidth={3}
                  fill="url(#voiceHourlyFill)"
                  dot={false}
                  activeDot={{ r: 5, fill: "var(--chart-line)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </section>
  );
});
