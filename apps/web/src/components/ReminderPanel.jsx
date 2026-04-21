import { useMemo, useState } from "react";

function formatReminder(reminder) {
  return `${reminder.schedule_type} at ${String(reminder.schedule_time).slice(0, 5)} ${reminder.timezone}`;
}

const DAY_OPTIONS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" }
];

function getDefaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function ReminderPanel({
  reminders,
  onCreateReminder,
  creatingReminder,
  loadingReminders = false
}) {
  const [form, setForm] = useState({
    title: "",
    message: "",
    scheduleType: "daily",
    scheduleTime: "09:00",
    scheduleDate: "",
    scheduleDays: [1],
    timezone: getDefaultTimezone()
  });
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");

  const pendingReminders = useMemo(
    () => reminders.filter((reminder) => !(reminder.last_sent_at && !reminder.active && !reminder.next_run_at)),
    [reminders]
  );
  const completedReminders = useMemo(
    () => reminders.filter((reminder) => reminder.last_sent_at && !reminder.active && !reminder.next_run_at),
    [reminders]
  );

  const canSubmit = useMemo(() => {
    if (!form.title.trim() || !form.message.trim() || !form.scheduleTime) {
      return false;
    }

    if (form.scheduleType === "once" && !form.scheduleDate) {
      return false;
    }

    if (form.scheduleType === "weekly" && !form.scheduleDays.length) {
      return false;
    }

    return true;
  }, [form]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError("Fill in the schedule details first.");
      return;
    }

    try {
      await onCreateReminder({
        title: form.title.trim(),
        message: form.message.trim(),
        scheduleType: form.scheduleType,
        scheduleTime: form.scheduleTime,
        scheduleDate: form.scheduleType === "once" ? form.scheduleDate : undefined,
        scheduleDays: form.scheduleType === "weekly" ? form.scheduleDays : [],
        timezone: form.timezone || "UTC",
        deliveryModes: ["dm"]
      });

      setForm((current) => ({
        ...current,
        title: "",
        message: "",
        scheduleDate: "",
        scheduleType: "daily",
        scheduleTime: "09:00",
        scheduleDays: [1]
      }));
    } catch (submitError) {
      setError(submitError.message || "Failed to create reminder.");
    }
  }

  function toggleWeeklyDay(dayValue) {
    setForm((current) => ({
      ...current,
      scheduleDays: current.scheduleDays.includes(dayValue)
        ? current.scheduleDays.filter((value) => value !== dayValue)
        : [...current.scheduleDays, dayValue].sort((left, right) => left - right)
    }));
  }

  function formatLastSent(reminder) {
    if (!reminder.last_sent_at) {
      return null;
    }

    return `Executed ${new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(reminder.last_sent_at))}`;
  }

  function getStatusLabel(reminder) {
    if (reminder.last_sent_at && !reminder.active && !reminder.next_run_at) {
      return { className: "pill pill-complete", label: "Executed" };
    }

    if (reminder.active) {
      return { className: "pill pill-live", label: "Pending" };
    }

    return { className: "pill", label: "Paused" };
  }

  const visibleReminders = activeTab === "completed" ? completedReminders : pendingReminders;

  return (
    <section className="panel reminder-workspace">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Reminders</p>
          <p className="panel-title">Disclytics will DM you when a reminder is due</p>
        </div>
      </div>

      <form className="reminder-form" onSubmit={handleSubmit}>
        <div className="reminder-form-grid">
          <label className="field">
            <span>Title</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Workout check-in"
              type="text"
              value={form.title}
            />
          </label>
          <label className="field">
            <span>Time</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, scheduleTime: event.target.value }))}
              type="time"
              value={form.scheduleTime}
            />
          </label>
        </div>

        <label className="field">
          <span>Message</span>
          <textarea
            onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
            placeholder="Remember to check in with your community today."
            rows={3}
            value={form.message}
          />
        </label>

        <div className="reminder-form-grid">
          <label className="field">
            <span>Schedule</span>
            <select
              onChange={(event) => setForm((current) => ({ ...current, scheduleType: event.target.value }))}
              value={form.scheduleType}
            >
              <option value="once">One time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <label className="field">
            <span>Timezone</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
              placeholder="Asia/Calcutta"
              type="text"
              value={form.timezone}
            />
          </label>
        </div>

        {form.scheduleType === "once" ? (
          <label className="field">
            <span>Date</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, scheduleDate: event.target.value }))}
              type="date"
              value={form.scheduleDate}
            />
          </label>
        ) : null}

        {form.scheduleType === "weekly" ? (
          <div className="field">
            <span>Repeat on</span>
            <div className="weekday-picker">
              {DAY_OPTIONS.map((day) => (
                <button
                  key={day.value}
                  className={`date-tab ${form.scheduleDays.includes(day.value) ? "date-tab-active" : ""}`}
                  onClick={() => toggleWeeklyDay(day.value)}
                  type="button"
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="reminder-form-footer">
          {error ? <p className="empty-state">{error}</p> : <p className="empty-state">Reminder delivery defaults to DM.</p>}
          <button className="primary-button" disabled={!canSubmit || creatingReminder} type="submit">
            {creatingReminder ? "Creating..." : "Create reminder"}
          </button>
        </div>
      </form>

      <div className="tab-row reminder-tabs">
        <button
          className={`tab-button ${activeTab === "pending" ? "tab-button-active" : ""}`}
          onClick={() => setActiveTab("pending")}
          type="button"
        >
          Pending reminders
        </button>
        <button
          className={`tab-button ${activeTab === "completed" ? "tab-button-active" : ""}`}
          onClick={() => setActiveTab("completed")}
          type="button"
        >
          Completed reminders
        </button>
      </div>

      <div className="reminder-list">
        {loadingReminders ? (
          <div className="panel-loading-state reminder-loading-state">
            <div>
              <p className="loading-title">Loading reminders</p>
              <p className="loading-copy">Fetching your latest reminder list.</p>
            </div>
          </div>
        ) : visibleReminders.length ? (
          visibleReminders.map((reminder) => {
            const status = getStatusLabel(reminder);

            return (
            <article key={reminder.id} className="reminder-item">
              <div>
                <h4>{reminder.title}</h4>
                <p>{reminder.message}</p>
                {activeTab === "completed" && formatLastSent(reminder) ? (
                  <p className="reminder-executed">{formatLastSent(reminder)}</p>
                ) : null}
              </div>
              <div className="reminder-meta">
                <span>{activeTab === "completed" ? formatLastSent(reminder) : formatReminder(reminder)}</span>
                <span className={status.className}>{status.label}</span>
              </div>
            </article>
            );
          })
        ) : (
          <p className="empty-state">
            {activeTab === "completed"
              ? "No completed reminders yet."
              : "No reminders yet. Create one and Disclytics will DM it to you when it is due."}
          </p>
        )}
      </div>
    </section>
  );
}
