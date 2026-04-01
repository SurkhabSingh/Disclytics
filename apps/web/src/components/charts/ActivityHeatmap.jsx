import { memo } from "react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getHeatClass(count) {
  if (count >= 12) return "heat-cell level-4";
  if (count >= 8) return "heat-cell level-3";
  if (count >= 4) return "heat-cell level-2";
  if (count >= 1) return "heat-cell level-1";
  return "heat-cell";
}

export const ActivityHeatmap = memo(function ActivityHeatmap({ data }) {
  const matrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));

  data.forEach((item) => {
    matrix[item.dayOfWeek][item.hourOfDay] = item.eventCount;
  });

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Heatmap</p>
          <p className="panel-title">Hourly activity pattern</p>
        </div>
      </div>
      <div className="heatmap">
        {matrix.map((row, dayIndex) => (
          <div key={DAY_LABELS[dayIndex]} className="heat-row">
            <span className="heat-label">{DAY_LABELS[dayIndex]}</span>
            <div className="heat-grid">
              {row.map((count, hour) => (
                <div
                  key={`${dayIndex}-${hour}`}
                  className={getHeatClass(count)}
                  title={`${DAY_LABELS[dayIndex]} ${hour}:00 - ${count} events`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
});
