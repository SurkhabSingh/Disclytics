import { memo, useMemo } from "react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from "recharts";

import {
  decorateEngagementPoints,
  ENGAGEMENT_LABELS,
  formatVoiceDuration
} from "../../utils/engagement";

const CLASSIFICATION_COLORS = {
  [ENGAGEMENT_LABELS.core]: "var(--scatter-core)",
  [ENGAGEMENT_LABELS.spammer]: "var(--scatter-spammer)",
  [ENGAGEMENT_LABELS.lurker]: "var(--scatter-lurker)",
  [ENGAGEMENT_LABELS.inactive]: "var(--scatter-inactive)"
};

const QUADRANT_GUIDES = [
  { label: ENGAGEMENT_LABELS.core, description: "High voice and high messages" },
  { label: ENGAGEMENT_LABELS.spammer, description: "Low voice and high messages" },
  { label: ENGAGEMENT_LABELS.lurker, description: "High voice and low messages" },
  { label: ENGAGEMENT_LABELS.inactive, description: "Low on both signals" }
];

function formatMessageValue(value, averageMode) {
  const numericValue = Number(value || 0);
  const suffix = averageMode ? "/day" : "";
  return `${numericValue.toFixed(numericValue >= 100 || !averageMode ? 0 : 1)}${suffix}`;
}

function formatVoiceValue(value, averageMode) {
  return averageMode ? `${formatVoiceDuration(value)}/day` : formatVoiceDuration(value);
}

function getAxisUpperBound(value) {
  const numericValue = Number(value || 0);
  if (numericValue <= 0) {
    return 1;
  }

  return numericValue * 1.12;
}

function groupByClassification(points) {
  return Object.values(ENGAGEMENT_LABELS).reduce((groups, label) => ({
    ...groups,
    [label]: points.filter((point) => point.classification === label && !point.isCurrentUser)
  }), {});
}

function ScatterTooltip({ active, averageMode, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0].payload;

  return (
    <div className="chart-tooltip-card">
      <p className="chart-tooltip-title">{point.displayName}</p>
      <p className="chart-tooltip-line">{point.classification}</p>
      <p className="chart-tooltip-line">Voice: {formatVoiceValue(point.voiceMetric, averageMode)}</p>
      <p className="chart-tooltip-line">Messages: {formatMessageValue(point.messageMetric, averageMode)}</p>
      {point.isCurrentUser ? <p className="chart-tooltip-line">This is you</p> : null}
    </div>
  );
}

function createScatterShape(highlightCurrentUser) {
  return function ScatterShape(props) {
    const {
      cx,
      cy,
      fill,
      payload,
      size
    } = props;

    if (typeof cx !== "number" || typeof cy !== "number") {
      return null;
    }

    const radius = Math.max(8, Math.sqrt(Number(payload?.bubbleSize || size || 0)) / 2.4);
    const isCurrentUser = highlightCurrentUser && payload?.isCurrentUser;

    return (
      <circle
        cx={cx}
        cy={cy}
        fill={fill}
        fillOpacity={isCurrentUser ? 0.95 : 0.82}
        r={isCurrentUser ? radius + 2 : radius}
        stroke={isCurrentUser ? "var(--text)" : fill}
        strokeWidth={isCurrentUser ? 3 : 1.5}
      />
    );
  };
}

export const EngagementScatterChart = memo(function EngagementScatterChart({
  averageMode = false,
  description,
  points,
  title,
  xKey,
  xLabel,
  yKey,
  yLabel
}) {
  const scatterModel = useMemo(() => {
    const decorated = decorateEngagementPoints(points, { xKey, yKey });
    const chartPoints = decorated.points.map((point) => ({
      ...point,
      voiceMetric: Number(point[xKey] || 0),
      messageMetric: Number(point[yKey] || 0),
      xValue: Number(point[xKey] || 0),
      yValue: Number(point[yKey] || 0)
    }));

    return {
      ...decorated,
      chartPoints,
      groupedPoints: groupByClassification(chartPoints),
      currentUserPoint: chartPoints.find((point) => point.isCurrentUser) || null
    };
  }, [points, xKey, yKey]);

  if (!scatterModel.chartPoints.length) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Engagement map</p>
            <p className="panel-title">{title}</p>
          </div>
        </div>
        <p className="chart-copy">{description}</p>
        <p className="empty-state">Peer comparison will appear once tracked users in your shared servers generate activity.</p>
      </section>
    );
  }

  const xDomain = [0, getAxisUpperBound(Math.max(...scatterModel.chartPoints.map((point) => point.xValue)))];
  const yDomain = [0, getAxisUpperBound(Math.max(...scatterModel.chartPoints.map((point) => point.yValue)))];

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Engagement map</p>
          <p className="panel-title">{title}</p>
        </div>
      </div>
      <p className="chart-copy">{description}</p>
      <div className="chart-shell scatter-chart-shell">
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 10, right: 18, bottom: 18, left: 8 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis
              allowDecimals={false}
              dataKey="xValue"
              domain={xDomain}
              name={xLabel}
              tickFormatter={(value) => formatVoiceValue(value, averageMode)}
              type="number"
            />
            <YAxis
              allowDecimals={false}
              dataKey="yValue"
              domain={yDomain}
              name={yLabel}
              tickFormatter={(value) => formatMessageValue(value, averageMode)}
              type="number"
            />
            <ZAxis dataKey="bubbleSize" range={[100, 420]} />
            <ReferenceLine
              stroke="var(--line)"
              strokeDasharray="6 6"
              x={scatterModel.thresholds.x}
            />
            <ReferenceLine
              stroke="var(--line)"
              strokeDasharray="6 6"
              y={scatterModel.thresholds.y}
            />
            <Tooltip
              content={<ScatterTooltip averageMode={averageMode} />}
              cursor={{ stroke: "var(--line)", strokeDasharray: "4 4" }}
              wrapperStyle={{ outline: "none" }}
            />
            {Object.entries(scatterModel.groupedPoints).map(([label, data]) => (
              data.length ? (
                <Scatter
                  key={label}
                  data={data}
                  fill={CLASSIFICATION_COLORS[label]}
                  name={label}
                  shape={createScatterShape(false)}
                />
              ) : null
            ))}
            {scatterModel.currentUserPoint ? (
              <Scatter
                data={[scatterModel.currentUserPoint]}
                fill="var(--brand)"
                name="You"
                shape={createScatterShape(true)}
              />
            ) : null}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="scatter-axis-labels">
        <span>X-axis: {xLabel}</span>
        <span>Y-axis: {yLabel}</span>
      </div>
      <div className="quadrant-guide-grid">
        {QUADRANT_GUIDES.map((guide) => (
          <article key={guide.label} className="quadrant-guide-card">
            <span
              className="quadrant-guide-dot"
              style={{ backgroundColor: CLASSIFICATION_COLORS[guide.label] }}
            />
            <div>
              <p className="quadrant-guide-title">{guide.label}</p>
              <p className="quadrant-guide-copy">{guide.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
});
