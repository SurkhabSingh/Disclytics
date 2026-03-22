import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date, delta) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function isSameMonth(left, right) {
  return left.getUTCFullYear() === right.getUTCFullYear() && left.getUTCMonth() === right.getUTCMonth();
}

export function HistoryCalendar({
  availableDates,
  onSelectDate,
  selectedDate,
  visibleMonth,
  onChangeMonth
}) {
  const selectedMonthDate = selectedDate ? new Date(`${selectedDate}T00:00:00.000Z`) : new Date();
  const monthDate = visibleMonth
    ? new Date(`${visibleMonth}-01T00:00:00.000Z`)
    : startOfMonth(selectedMonthDate);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = addMonths(monthStart, 1);
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric"
  }).format(monthStart);
  const firstGridDate = new Date(monthStart);
  firstGridDate.setUTCDate(monthStart.getUTCDate() - monthStart.getUTCDay());
  const dateSet = new Set(availableDates || []);
  const dayCells = Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(firstGridDate);
    cellDate.setUTCDate(firstGridDate.getUTCDate() + index);
    return cellDate;
  });

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">History</p>
          <p className="panel-title">Choose a tracked date</p>
        </div>
        <div className="calendar-nav">
          <button className="secondary-button icon-button icon-button-compact" onClick={() => onChangeMonth(addMonths(monthStart, -1))} type="button">
            <FiChevronLeft aria-hidden="true" />
          </button>
          <span className="calendar-label">{monthLabel}</span>
          <button className="secondary-button icon-button icon-button-compact" onClick={() => onChangeMonth(addMonths(monthStart, 1))} type="button">
            <FiChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="calendar-weekdays">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {dayCells.map((cellDate) => {
          const isoDate = formatIsoDate(cellDate);
          const hasData = dateSet.has(isoDate);
          const isSelected = selectedDate === isoDate;
          const isCurrentMonth = isSameMonth(cellDate, monthStart);

          return (
            <button
              key={isoDate}
              className={`calendar-day ${isSelected ? "calendar-day-active" : ""} ${hasData ? "calendar-day-available" : ""} ${isCurrentMonth ? "" : "calendar-day-muted"}`}
              disabled={!hasData}
              onClick={() => onSelectDate(isoDate)}
              type="button"
            >
              <span>{cellDate.getUTCDate()}</span>
            </button>
          );
        })}
      </div>
      {!availableDates?.length ? (
        <p className="empty-state calendar-empty">Tracked dates will appear here once activity is recorded.</p>
      ) : null}
    </section>
  );
}
