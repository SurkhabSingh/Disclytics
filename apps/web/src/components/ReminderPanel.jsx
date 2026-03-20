function formatReminder(reminder) {
  return `${reminder.schedule_type} at ${String(reminder.schedule_time).slice(0, 5)} ${reminder.timezone}`;
}

export function ReminderPanel({ reminders }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Reminders</p>
          <h3>Scheduled nudges</h3>
        </div>
      </div>
      <div className="reminder-list">
        {reminders.length ? (
          reminders.slice(0, 5).map((reminder) => (
            <article key={reminder.id} className="reminder-item">
              <div>
                <h4>{reminder.title}</h4>
                <p>{reminder.message}</p>
              </div>
              <div className="reminder-meta">
                <span>{formatReminder(reminder)}</span>
                <span className={reminder.active ? "pill pill-live" : "pill"}>{reminder.active ? "Active" : "Paused"}</span>
              </div>
            </article>
          ))
        ) : (
          <p className="empty-state">No reminders yet. The backend is ready for DM, channel, and voice delivery.</p>
        )}
      </div>
    </section>
  );
}
