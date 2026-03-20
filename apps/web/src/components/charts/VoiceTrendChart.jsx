import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

function formatMinutes(seconds) {
  return Math.round(seconds / 60);
}

export function VoiceTrendChart({ data }) {
  const chartData = data.map((item) => ({
    ...item,
    voiceMinutes: formatMinutes(item.totalVoiceSeconds)
  }));

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Timeline</p>
          <h3>Daily activity trend</h3>
        </div>
      </div>
      <div className="chart-shell">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(44, 39, 33, 0.12)" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="totalMessages" name="Messages" fill="#d98f43" radius={[6, 6, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="voiceMinutes" name="Voice minutes" stroke="#16423c" strokeWidth={3} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
