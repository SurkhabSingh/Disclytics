export function MetricCard({ label, value, detail }) {
  return (
    <section className="metric-card">
      <p className="metric-label">{label}</p>
      <h3 className="metric-value">{value}</h3>
      <p className="metric-detail">{detail}</p>
    </section>
  );
}
