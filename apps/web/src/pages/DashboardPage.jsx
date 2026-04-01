import { useEffect, useMemo, useState } from "react";
import { FiLogIn, FiLogOut, FiMoon, FiPlus, FiSun } from "react-icons/fi";

import { analyticsApi, authApi, remindersApi } from "../api/client";
import { ActivityDetailsPanel } from "../components/ActivityDetailsPanel";
import { EngagementKpiGrid } from "../components/EngagementKpiGrid";
import { HistoryCalendar } from "../components/HistoryCalendar";
import { LeaderboardPanel } from "../components/LeaderboardPanel";
import { MetricCard } from "../components/MetricCard";
import { ReminderPanel } from "../components/ReminderPanel";
import { ActivityHeatmap } from "../components/charts/ActivityHeatmap";
import { EngagementScatterChart } from "../components/charts/EngagementScatterChart";
import { EngagementTrendChart } from "../components/charts/EngagementTrendChart";
import { HourlyUsageChart } from "../components/charts/HourlyUsageChart";
import { applyLiveVoiceProgress } from "../features/analytics/dashboardModel";

const THEME_STORAGE_KEY = "disclytics-theme";
const DASHBOARD_REFRESH_MS = 10000;
const LIVE_VOICE_TICK_MS = 1000;

const FEATURE_CHANNELS = [
  {
    id: "today",
    label: "today's activity",
    description: "Live activity, channels you used today, and a simple hourly graph."
  },
  {
    id: "history",
    label: "history",
    description: "Choose a tracked date from the calendar and load that day's activity."
  },
  {
    id: "lifetime",
    label: "lifetime",
    description: "Combined historical analytics, including today, with long-term trends and leaderboards."
  },
  {
    id: "reminders",
    label: "reminders",
    description: "Create reminders and let Disclytics DM them back to you when they are due."
  }
];

function formatVoiceSeconds(seconds) {
  const totalMinutes = Math.max(0, Math.round((seconds || 0) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatRefreshTime(value) {
  if (!value) {
    return "Auto-refreshing every 10 seconds";
  }

  return `Live refresh active. Last sync ${new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value))}`;
}

function getInitialTheme() {
  if (typeof window === "undefined") {
    return "light";
  }

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getMonthToken(dateValue) {
  return dateValue ? dateValue.slice(0, 7) : new Date().toISOString().slice(0, 7);
}

function ChannelIntro({ channelName, description }) {
  return (
    <div className="bot-message">
      <div className="bot-avatar">D</div>
      <div className="bot-message-body">
        <div className="bot-message-meta">
          <strong>Disclytics</strong>
          <span>#{channelName}</span>
        </div>
        <p>{description}</p>
      </div>
    </div>
  );
}

function UserBrandGlyph({ user }) {
  if (user?.avatar_url) {
    return <img alt="" className="brand-glyph brand-glyph-image" src={user.avatar_url} />;
  }

  return <div className="brand-glyph">D</div>;
}

function FeatureSidebar({ activeChannel, onSelectChannel }) {
  return (
    <aside className="feature-sidebar">
      <p className="sidebar-heading">Disclytics</p>
      <div className="sidebar-section">
        {FEATURE_CHANNELS.map((channel) => (
          <button
            key={channel.id}
            className={`sidebar-channel ${activeChannel === channel.id ? "sidebar-channel-active" : ""}`}
            onClick={() => onSelectChannel(channel.id)}
            type="button"
          >
            <span className="sidebar-channel-mark">#</span>
            <span>{channel.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function ScopeMetrics({ scope, detail }) {
  return (
    <section className="metric-grid">
      <MetricCard
        detail={detail}
        label="Messages"
        value={scope.summary.totalMessages}
      />
      <MetricCard
        detail={detail}
        label="Voice time"
        value={formatVoiceSeconds(scope.summary.totalVoiceSeconds)}
      />
      <MetricCard
        detail={`${scope.summary.mostActiveChannelCount} tracked events`}
        label="Most active channel"
        value={scope.summary.mostActiveChannelName || "N/A"}
      />
    </section>
  );
}

export function DashboardPage() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [activeChannel, setActiveChannel] = useState("today");
  const [selectedDate, setSelectedDate] = useState(null);
  const [visibleMonth, setVisibleMonth] = useState(null);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  const [creatingReminder, setCreatingReminder] = useState(false);
  const [state, setState] = useState({
    loading: true,
    authenticated: true,
    user: null,
    botInstallUrl: null,
    dashboard: null,
    reminders: [],
    error: null,
    lastUpdatedAt: null
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowTimestamp(Date.now());
    }, LIVE_VOICE_TICK_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [{ user, botInstallUrl }, dashboard, remindersResponse] = await Promise.all([
          authApi.getCurrentUser(),
          analyticsApi.getDashboard(selectedDate),
          remindersApi.list().catch(() => ({ reminders: [] }))
        ]);

        if (!active) {
          return;
        }

        if (dashboard?.selectedDate && dashboard.selectedDate !== selectedDate) {
          setSelectedDate(dashboard.selectedDate);
        }

        if (!visibleMonth && dashboard?.selectedDate) {
          setVisibleMonth(getMonthToken(dashboard.selectedDate));
        }

        setState({
          loading: false,
          authenticated: true,
          user,
          botInstallUrl: botInstallUrl || null,
          dashboard,
          reminders: Array.isArray(remindersResponse?.reminders) ? remindersResponse.reminders : [],
          error: null,
          lastUpdatedAt: new Date().toISOString()
        });
      } catch (error) {
        if (!active) {
          return;
        }

        if (error.status === 401) {
          setState({
            loading: false,
            authenticated: false,
            user: null,
            botInstallUrl: null,
            dashboard: null,
            reminders: [],
            error: null,
            lastUpdatedAt: null
          });
          return;
        }

        setState((previous) => ({
          ...previous,
          loading: false,
          error: previous.dashboard ? null : error.message
        }));
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        load();
      }
    }

    load();
    const intervalId = window.setInterval(load, DASHBOARD_REFRESH_MS);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [selectedDate, visibleMonth]);

  const dashboard = useMemo(
    () => applyLiveVoiceProgress(state.dashboard, state.lastUpdatedAt, nowTimestamp),
    [state.dashboard, state.lastUpdatedAt, nowTimestamp]
  );

  async function handleCreateReminder(payload) {
    setCreatingReminder(true);

    try {
      const { reminder } = await remindersApi.create(payload);
      setState((previous) => ({
        ...previous,
        reminders: [reminder, ...previous.reminders]
      }));
    } finally {
      setCreatingReminder(false);
    }
  }

  if (state.loading) {
    return <div className="shell"><div className="hero-card">Loading Disclytics...</div></div>;
  }

  if (!state.authenticated) {
    return (
      <div className="shell">
        <nav className="app-navbar">
          <div className="brand-lockup">
            <div className="brand-glyph">D</div>
            <div>
              <p className="eyebrow">Disclytics</p>
              <h1 className="brand-title">Discord activity, made honest.</h1>
            </div>
          </div>
          <div className="nav-actions">
            <button
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              className="secondary-button icon-button"
              onClick={() => setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark")}
              type="button"
            >
              {theme === "dark" ? <FiSun aria-hidden="true" /> : <FiMoon aria-hidden="true" />}
            </button>
            <a aria-label="Login with Discord" className="primary-button icon-button" href={authApi.getLoginUrl()}>
              <FiLogIn aria-hidden="true" />
            </a>
          </div>
        </nav>
        <section className="hero-card landing-card">
          <div className="hero-copy">
            <p className="eyebrow">Disclytics</p>
            <h1>Server-scoped Discord analytics that stay inside platform rules</h1>
            <p>
              Disclytics tracks messages and voice activity only in servers where your bot is present.
              Nothing global, nothing hidden, and nothing outside the communities that explicitly install it.
            </p>
          </div>
        </section>
      </div>
    );
  }

  if (state.error || !dashboard) {
    return <div className="shell"><div className="hero-card">Failed to load dashboard: {state.error}</div></div>;
  }

  const todayScope = dashboard.scopes.today;
  const historyScope = dashboard.scopes.history;
  const lifetimeScope = dashboard.scopes.lifetime;
  const activeChannelMeta = FEATURE_CHANNELS.find((channel) => channel.id === activeChannel) || FEATURE_CHANNELS[0];

  function renderTodayChannel() {
    return (
      <>
        <ChannelIntro
          channelName={activeChannelMeta.label}
          description="Here is everything Disclytics has tracked for you today so far, including your current live voice time."
        />
        <ScopeMetrics detail={`Today | ${dashboard.todayDate}`} scope={todayScope} />
        <section className="dashboard-grid analytics-primary-grid">
          <HourlyUsageChart
            data={todayScope.hourlyBreakdown}
            selectedDate={dashboard.todayDate}
          />
          <LeaderboardPanel
            chatChannels={todayScope.leaderboards.chatChannels}
            viewLabel="Today"
            voiceChannels={todayScope.leaderboards.voiceChannels}
          />
        </section>
        <ActivityDetailsPanel
          recentMessages={todayScope.recentMessages}
          recentVoiceSessions={todayScope.recentVoiceSessions}
        />
      </>
    );
  }

  function renderHistoryChannel() {
    return (
      <>
        <ChannelIntro
          channelName={activeChannelMeta.label}
          description="Pick a date from the calendar and Disclytics will load that day's tracked voice and message activity."
        />
        <section className="dashboard-grid history-grid">
          <HistoryCalendar
            availableDates={dashboard.availableDates}
            onChangeMonth={(date) => setVisibleMonth(date.toISOString().slice(0, 7))}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setVisibleMonth(getMonthToken(date));
            }}
            selectedDate={dashboard.selectedDate}
            visibleMonth={visibleMonth}
          />
          <section className="panel history-summary-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Selected date</p>
                <p className="panel-title">{dashboard.selectedDate}</p>
              </div>
            </div>
            <p className="chart-copy">
              Only dates with tracked data are clickable. Change the month and pick a valid date to load its history.
            </p>
            <ScopeMetrics detail={`History | ${dashboard.selectedDate}`} scope={historyScope} />
          </section>
        </section>
        <section className="dashboard-grid analytics-primary-grid">
          <HourlyUsageChart
            data={historyScope.hourlyBreakdown}
            selectedDate={dashboard.selectedDate}
          />
          <LeaderboardPanel
            chatChannels={historyScope.leaderboards.chatChannels}
            viewLabel={`History | ${dashboard.selectedDate}`}
            voiceChannels={historyScope.leaderboards.voiceChannels}
          />
        </section>
        <ActivityDetailsPanel
          recentMessages={historyScope.recentMessages}
          recentVoiceSessions={historyScope.recentVoiceSessions}
        />
      </>
    );
  }

  function renderLifetimeChannel() {
    return (
      <>
        <ChannelIntro
          channelName={activeChannelMeta.label}
          description="This combines all tracked Disclytics history, including today, so you can compare your engagement against other tracked users in your shared servers."
        />
        <EngagementKpiGrid
          summary={lifetimeScope.summary}
          trackedDayCount={lifetimeScope.comparison?.trackedDayCount}
          trackedStartDate={dashboard.trackedRange.firstActivityDate}
        />
        <section className="dashboard-grid engagement-scatter-grid">
          <EngagementScatterChart
            description="Each bubble is a tracked user from the servers you share with the bot. Bubble size reflects overall engagement, and the quadrant lines split the crowd into behavior groups."
            points={lifetimeScope.comparison?.peers?.lifetime || []}
            title="Lifetime engagement map"
            xKey="totalVoiceSeconds"
            xLabel="Total voice time"
            yKey="totalMessages"
            yLabel="Total messages"
          />
          <EngagementScatterChart
            averageMode
            description={`This view averages the last ${lifetimeScope.comparison?.recentWindowDays || 7} days so you can spot current engagement habits, not just all-time volume.`}
            points={lifetimeScope.comparison?.peers?.daily || []}
            title="Recent daily engagement map"
            xKey="avgVoiceSecondsPerDay"
            xLabel="Avg voice time per day"
            yKey="avgMessagesPerDay"
            yLabel="Avg messages per day"
          />
        </section>
        <EngagementTrendChart
          data={lifetimeScope.trend}
          trackedStartDate={dashboard.trackedRange.firstActivityDate}
        />
        <section className="dashboard-grid lifetime-secondary-grid">
          <LeaderboardPanel
            chatChannels={lifetimeScope.leaderboards.chatChannels}
            viewLabel="Lifetime"
            voiceChannels={lifetimeScope.leaderboards.voiceChannels}
          />
          <ActivityHeatmap data={dashboard.heatmap} />
        </section>
        <ActivityDetailsPanel
          recentMessages={lifetimeScope.recentMessages}
          recentVoiceSessions={lifetimeScope.recentVoiceSessions}
        />
      </>
    );
  }

  function renderReminderChannel() {
    return (
      <>
        <ChannelIntro
          channelName={activeChannelMeta.label}
          description="Create reminders here and Disclytics will DM them back to you when the schedule is reached."
        />
        <ReminderPanel
          creatingReminder={creatingReminder}
          onCreateReminder={handleCreateReminder}
          reminders={state.reminders}
        />
      </>
    );
  }

  function renderChannelContent() {
    if (activeChannel === "today") {
      return renderTodayChannel();
    }

    if (activeChannel === "history") {
      return renderHistoryChannel();
    }

    if (activeChannel === "lifetime") {
      return renderLifetimeChannel();
    }

    return renderReminderChannel();
  }

  return (
    <div className="discord-app">
      <nav className="app-navbar">
        <div className="brand-lockup">
          <UserBrandGlyph user={state.user} />
          <div>
            <p className="eyebrow">Disclytics</p>
            <h1 className="brand-title">
              {state.user?.global_name || state.user?.username || "Disclytics User"}
            </h1>
          </div>
        </div>
        <div className="nav-actions">
          <button
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="secondary-button icon-button"
            onClick={() => setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark")}
            type="button"
          >
            {theme === "dark" ? <FiSun aria-hidden="true" /> : <FiMoon aria-hidden="true" />}
          </button>
          {state.botInstallUrl ? (
            <a
              aria-label="Invite bot"
              className="secondary-button icon-button"
              href={state.botInstallUrl}
              rel="noreferrer"
              target="_blank"
            >
              <FiPlus aria-hidden="true" />
            </a>
          ) : null}
          <button
            aria-label="Logout"
            className="secondary-button icon-button"
            onClick={() => authApi.logout().then(() => window.location.reload())}
            type="button"
          >
            <FiLogOut aria-hidden="true" />
          </button>
        </div>
      </nav>

      <div className="workspace-shell">
        <FeatureSidebar activeChannel={activeChannel} onSelectChannel={setActiveChannel} />

        <main className="channel-stage">
          <header className="channel-header">
            <div>
              <p className="channel-title">#{activeChannelMeta.label}</p>
              <p className="channel-subtitle">{activeChannelMeta.description}</p>
            </div>
            <p className="toolbar-caption">{formatRefreshTime(state.lastUpdatedAt)}</p>
          </header>

          <div className="channel-scroll">
            {renderChannelContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
