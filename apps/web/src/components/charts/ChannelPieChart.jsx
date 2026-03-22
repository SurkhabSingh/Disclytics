import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "var(--pie-1)",
  "var(--pie-2)",
  "var(--pie-3)",
  "var(--pie-4)",
  "var(--pie-5)",
  "var(--pie-6)",
  "var(--pie-7)",
  "var(--pie-8)"
];

export function ChannelPieChart({ data }) {
  const chartData = (data || []).map((item) => ({
    ...item,
    name: item.channelName || item.channelId
  }));

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Channel mix</p>
          <p className="panel-title">Where messages happen</p>
        </div>
      </div>
      {chartData.length ? (
        <div className="chart-shell">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="messageCount"
                nameKey="name"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
              >
                {chartData.map((entry, index) => (
                  <Cell key={entry.channelId} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--tooltip-bg)",
                  border: "1px solid var(--tooltip-border)",
                  borderRadius: "10px",
                  color: "var(--tooltip-text)"
                }}
                formatter={(value, name) => [`${value} messages`, name]}
                itemStyle={{ color: "var(--tooltip-text)" }}
                labelStyle={{ color: "var(--tooltip-text)" }}
                wrapperStyle={{ outline: "none" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="empty-state">No chat activity is available for this scope yet.</p>
      )}
    </section>
  );
}
