import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#16423c", "#3a7d44", "#d98f43", "#f4b860", "#a24c27", "#6b8f71", "#8c5e3c", "#ccb08a"];

export function ChannelPieChart({ data }) {
  const chartData = data.map((item) => ({
    ...item,
    name: item.channelId
  }));

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Channel mix</p>
          <h3>Where messages happen</h3>
        </div>
      </div>
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
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
