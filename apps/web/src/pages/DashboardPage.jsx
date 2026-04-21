import { useEffect, useState } from "react";
import {
  FiArrowRight,
  FiBell,
  FiCalendar,
  FiLogIn,
  FiLogOut,
  FiMessageSquare,
  FiMic,
  FiMoon,
  FiPlus,
  FiSun,
} from "react-icons/fi";

import { analyticsApi, authApi, remindersApi } from "../api/client";
import { ActivityDetailsPanel } from "../components/ActivityDetailsPanel";
import { EngagementKpiGrid } from "../components/EngagementKpiGrid";
import { HistoryCalendar } from "../components/HistoryCalendar";
import { LeaderboardPanel } from "../components/LeaderboardPanel";
import { MetricCard } from "../components/MetricCard";
import { ReminderPanel } from "../components/ReminderPanel";
import { ActivityHeatmap } from "../components/charts/ActivityHeatmap";
import { EngagementTrendChart } from "../components/charts/EngagementTrendChart";
import { HourlyUsageChart } from "../components/charts/HourlyUsageChart";
import {
  createEmptyScope,
  normalizeHistoryPayload,
  normalizeLifetimePayload,
  normalizeOverviewPayload,
} from "../features/analytics/dashboardModel";

const THEME_STORAGE_KEY = "disclytics-theme";

function syncRouteForAuthState(isAuthenticated) {
  if (typeof window === "undefined") {
    return;
  }

  const targetPath = isAuthenticated ? "/dashboard" : "/";
  if (window.location.pathname === targetPath) {
    return;
  }

  window.history.replaceState({}, "", targetPath);
}

const FEATURE_CHANNELS = [
  {
    id: "today",
    label: "today's activity",
    description:
      "Today's activity, channels you used today, and a simple hourly graph.",
  },
  {
    id: "history",
    label: "history",
    description:
      "Choose a tracked date from the calendar and load that day's activity.",
  },
  {
    id: "lifetime",
    label: "lifetime",
    description:
      "Combined historical analytics, including today, with long-term trends and leaderboards.",
  },
  {
    id: "reminders",
    label: "reminders",
    description:
      "Create reminders and let Disclytics DM them back to you when they are due.",
  },
];

const LANDING_FEATURES = [
  {
    id: "feature-today",
    icon: FiMic,
    title: "Track today's activity",
    description:
      "See how much time you spent in voice, how many messages you sent, and which channels were active today.",
  },
  {
    id: "feature-history",
    icon: FiCalendar,
    title: "Browse historical days",
    description:
      "Open any tracked date from the calendar and load the exact voice sessions, messages, and activity totals for that day.",
  },
  {
    id: "feature-lifetime",
    icon: FiMessageSquare,
    title: "Understand long-term patterns",
    description:
      "Follow lifetime trends, channel leaderboards, and recurring habits across the servers where Disclytics is installed.",
  },
  {
    id: "feature-reminders",
    icon: FiBell,
    title: "Schedule reminder DMs",
    description:
      "Create reminders from the dashboard or Discord and let Disclytics send them back to you when they are due.",
  },
];

function formatVoiceSeconds(seconds) {
  const totalMinutes = Math.max(0, Math.round((seconds || 0) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatRefreshTime(value) {
  if (!value) {
    return "Refresh the page to load the latest analytics";
  }

  return `Snapshot from ${new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
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

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getMonthToken(dateValue) {
  return dateValue
    ? dateValue.slice(0, 7)
    : new Date().toISOString().slice(0, 7);
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
    return (
      <img
        alt=""
        className="brand-glyph brand-glyph-image"
        src={user.avatar_url}
      />
    );
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

function LandingFeatureCard({ description, icon: Icon, title }) {
  return (
    <article className="panel landing-feature-card">
      <div className="landing-feature-icon">
        <Icon aria-hidden="true" />
      </div>
      <div>
        <p className="panel-title landing-feature-title">{title}</p>
        <p className="chart-copy landing-feature-copy">{description}</p>
      </div>
    </article>
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

function createDashboardStateShell() {
  return {
    availableDates: [],
    coverage: {
      accessibleGuilds: 0,
      trackedGuilds: 0,
      percent: 0,
    },
    heatmap: [],
    scopes: {
      history: createEmptyScope(),
      lifetime: createEmptyScope(),
      today: createEmptyScope(),
    },
    selectedDate: null,
    timezone: null,
    todayDate: null,
    trackedRange: {
      firstActivityDate: null,
      lastActivityDate: null,
    },
  };
}

function FullPageLoader() {
  return (
    <div className="shell shell-centered">
      <section className="hero-card state-card loading-shell-card">
        <div className="loading-shell-copy">
          <p className="eyebrow">Disclytics</p>
          <h1>Loading your dashboard</h1>
          <p>
            Pulling your latest analytics, reminders, and channel activity.
          </p>
        </div>
        <div className="loading-shell-preview" aria-hidden="true">
          <div className="loading-shimmer-block loading-shimmer-block-large" />
          <div className="loading-shimmer-row">
            <div className="loading-shimmer-block" />
            <div className="loading-shimmer-block" />
            <div className="loading-shimmer-block" />
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionLoader({ copy, title }) {
  return (
    <section className="panel panel-loading-state">
      <div>
        <p className="loading-title">{title}</p>
        <p className="loading-copy">{copy}</p>
      </div>
    </section>
  );
}

export function DashboardPage() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [activeChannel, setActiveChannel] = useState("today");
  const [selectedDate, setSelectedDate] = useState(null);
  const [visibleMonth, setVisibleMonth] = useState(null);
  const [creatingReminder, setCreatingReminder] = useState(false);
  const [state, setState] = useState({
    loading: true,
    authenticated: true,
    user: null,
    botInstallUrl: null,
    dashboard: createDashboardStateShell(),
    reminders: [],
    error: null,
    historyLoading: false,
    lastUpdatedAt: null,
    lifetimeLoaded: false,
    lifetimeLoading: false,
    remindersLoading: false,
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (state.loading) {
      return;
    }

    syncRouteForAuthState(state.authenticated);
  }, [state.authenticated, state.loading]);

  useEffect(() => {
    let active = true;
    const bootstrapAbortController = new AbortController();

    async function load() {
      setState((previous) => ({
        ...previous,
        error: null,
        loading: true
      }));

      try {
        const [{ user, botInstallUrl }, overviewPayload] = await Promise.all([
          authApi.getCurrentUser({
            signal: bootstrapAbortController.signal,
          }),
          analyticsApi.getOverview(null, {
            signal: bootstrapAbortController.signal,
          }),
        ]);
        const overview = normalizeOverviewPayload(overviewPayload);
        const dashboard = {
          ...createDashboardStateShell(),
          ...overview,
          scopes: {
            history: createEmptyScope(),
            lifetime: createEmptyScope(),
            today: overview.scopes.today
          }
        };

        if (!active) {
          return;
        }

        if (overview?.selectedDate) {
          setSelectedDate(overview.selectedDate);
          setVisibleMonth(
            (currentVisibleMonth) =>
              currentVisibleMonth || getMonthToken(overview.selectedDate),
          );
        }

        setState((previous) => ({
          ...previous,
          loading: false,
          authenticated: true,
          user,
          botInstallUrl: botInstallUrl || null,
          dashboard,
          error: null,
          historyLoading: false,
          lastUpdatedAt: new Date().toISOString(),
        }));
      } catch (error) {
        if (!active) {
          return;
        }

        if (error?.name === "AbortError") {
          return;
        }

        if (error.status === 401) {
          setState({
            loading: false,
            authenticated: false,
            user: null,
            botInstallUrl: null,
            dashboard: createDashboardStateShell(),
            reminders: [],
            error: null,
            historyLoading: false,
            lastUpdatedAt: null,
            lifetimeLoaded: false,
            lifetimeLoading: false,
            remindersLoading: false,
          });
          return;
        }

        setState((previous) => ({
          ...previous,
          loading: false,
          historyLoading: false,
          lifetimeLoading: false,
          error: previous.lastUpdatedAt ? null : error.message,
        }));
      }
    }

    void load();

    return () => {
      active = false;
      bootstrapAbortController.abort();
    };
  }, []);

  useEffect(() => {
    if (
      state.loading ||
      !state.authenticated ||
      !selectedDate ||
      activeChannel !== "history" ||
      state.dashboard.scopes.history.date === selectedDate
    ) {
      return undefined;
    }

    let active = true;
    const historyAbortController = new AbortController();

    async function loadHistory() {
      setState((previous) => ({
        ...previous,
        historyLoading: true
      }));

      try {
        const historyPayload = await analyticsApi.getHistory(selectedDate, {
          signal: historyAbortController.signal
        });
        const history = normalizeHistoryPayload(historyPayload);

        if (!active) {
          return;
        }

        setState((previous) => ({
          ...previous,
          dashboard: {
            ...previous.dashboard,
            availableDates: history.availableDates.length
              ? history.availableDates
              : previous.dashboard.availableDates,
            scopes: {
              ...previous.dashboard.scopes,
              history: history.scopes.history
            },
            selectedDate: history.selectedDate || previous.dashboard.selectedDate,
            timezone: history.timezone || previous.dashboard.timezone,
            todayDate: history.todayDate || previous.dashboard.todayDate,
            trackedRange: {
              ...previous.dashboard.trackedRange,
              ...history.trackedRange
            }
          },
          historyLoading: false,
          lastUpdatedAt: new Date().toISOString()
        }));
      } catch (error) {
        if (!active || error?.name === "AbortError") {
          return;
        }

        setState((previous) => ({
          ...previous,
          historyLoading: false
        }));
      }
    }

    void loadHistory();

    return () => {
      active = false;
      historyAbortController.abort();
    };
  }, [activeChannel, selectedDate, state.authenticated, state.dashboard.scopes.history.date, state.loading]);

  useEffect(() => {
    if (
      state.loading ||
      !state.authenticated ||
      activeChannel !== "lifetime" ||
      state.lifetimeLoaded
    ) {
      return undefined;
    }

    let active = true;
    const lifetimeAbortController = new AbortController();

    async function loadLifetime() {
      setState((previous) => ({
        ...previous,
        lifetimeLoading: true
      }));

      try {
        const lifetimePayload = await analyticsApi.getLifetime({
          signal: lifetimeAbortController.signal
        });
        const lifetime = normalizeLifetimePayload(lifetimePayload);

        if (!active) {
          return;
        }

        setState((previous) => ({
          ...previous,
          dashboard: {
            ...previous.dashboard,
            heatmap: lifetime.heatmap,
            scopes: {
              ...previous.dashboard.scopes,
              lifetime: lifetime.scopes.lifetime
            },
            timezone: lifetime.timezone || previous.dashboard.timezone,
            todayDate: lifetime.todayDate || previous.dashboard.todayDate,
            trackedRange: {
              ...previous.dashboard.trackedRange,
              ...lifetime.trackedRange
            }
          },
          lifetimeLoaded: true,
          lifetimeLoading: false,
          lastUpdatedAt: new Date().toISOString()
        }));
      } catch (error) {
        if (!active || error?.name === "AbortError") {
          return;
        }

        setState((previous) => ({
          ...previous,
          lifetimeLoading: false
        }));
      }
    }

    void loadLifetime();

    return () => {
      active = false;
      lifetimeAbortController.abort();
    };
  }, [activeChannel, state.authenticated, state.lifetimeLoaded, state.loading]);

  useEffect(() => {
    if (state.loading || !state.authenticated) {
      return undefined;
    }

    let active = true;
    const remindersAbortController = new AbortController();

    async function loadReminders() {
      setState((previous) => ({
        ...previous,
        remindersLoading: true
      }));

      try {
        const remindersResponse = await remindersApi.list({
          signal: remindersAbortController.signal,
        });

        if (!active) {
          return;
        }

        setState((previous) => ({
          ...previous,
          reminders: Array.isArray(remindersResponse?.reminders)
            ? remindersResponse.reminders
            : [],
          remindersLoading: false
        }));
      } catch (error) {
        if (!active || error?.name === "AbortError") {
          return;
        }

        setState((previous) => ({
          ...previous,
          remindersLoading: false
        }));
      }
    }

    void loadReminders();

    return () => {
      active = false;
      remindersAbortController.abort();
    };
  }, [state.loading, state.authenticated]);

  const dashboard = state.dashboard;

  async function handleCreateReminder(payload) {
    setCreatingReminder(true);

    try {
      const { reminder } = await remindersApi.create(payload);
      setState((previous) => ({
        ...previous,
        reminders: [reminder, ...previous.reminders],
      }));
    } finally {
      setCreatingReminder(false);
    }
  }

  if (state.loading) {
    return <FullPageLoader />;
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
              aria-label={
                theme === "dark"
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
              className="secondary-button icon-button"
              onClick={() =>
                setTheme((currentTheme) =>
                  currentTheme === "dark" ? "light" : "dark",
                )
              }
              type="button"
            >
              {theme === "dark" ? (
                <FiSun aria-hidden="true" />
              ) : (
                <FiMoon aria-hidden="true" />
              )}
            </button>
            <a
              aria-label="Login with Discord"
              className="primary-button icon-button"
              href={authApi.getLoginUrl()}
            >
              <FiLogIn aria-hidden="true" />
            </a>
          </div>
        </nav>
        <section className="hero-card landing-card landing-hero-card">
          <div className="hero-copy">
            <p className="eyebrow">Disclytics</p>
            <h1>Know who is active in your Discord without breaking trust.</h1>
            <p>
              Disclytics gives server-scoped analytics for messages, voice
              sessions, reminders, and channel activity. It only tracks what
              happens inside servers where the bot is actually installed.
            </p>
            <div className="landing-cta-row">
              <a
                className="primary-button"
                href={authApi.getInstallUrl()}
                rel="noreferrer"
                target="_blank"
              >
                Add to Discord
              </a>
              <a className="secondary-button" href="#features">
                See features
              </a>
            </div>
          </div>
          <div className="action-panel landing-side-note">
            <p className="eyebrow">Built for clarity</p>
            <p className="panel-title">
              No global tracking. No self-bots. No user tokens.
            </p>
            <p className="chart-copy">
              Disclytics stays inside Discord’s rules and focuses on the servers
              that intentionally install the bot.
            </p>
            <a
              className="secondary-button landing-login-link"
              href={authApi.getLoginUrl()}
            >
              Sign in to your dashboard
              <FiArrowRight aria-hidden="true" />
            </a>
          </div>
        </section>

        <section className="landing-features" id="features">
          <div className="landing-section-heading">
            <p className="eyebrow">Features</p>
            <p className="panel-title landing-section-title">
              Everything Disclytics gives your server in one simple flow
            </p>
          </div>
          <div className="landing-feature-grid">
            {LANDING_FEATURES.map((feature) => (
              <LandingFeatureCard
                key={feature.id}
                description={feature.description}
                icon={feature.icon}
                title={feature.title}
              />
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="shell">
        <div className="hero-card">Failed to load dashboard: {state.error}</div>
      </div>
    );
  }

  const todayScope = dashboard.scopes.today;
  const historyScope = dashboard.scopes.history;
  const lifetimeScope = dashboard.scopes.lifetime;
  const historyScopeReady = historyScope.date === dashboard.selectedDate;
  const activeChannelMeta =
    FEATURE_CHANNELS.find((channel) => channel.id === activeChannel) ||
    FEATURE_CHANNELS[0];

  function renderTodayChannel() {
    return (
      <>
        <ChannelIntro
          channelName={activeChannelMeta.label}
          description="Here is everything Disclytics has tracked for you today so far, including your voice time so far."
        />
        <ScopeMetrics
          detail={`Today | ${dashboard.todayDate}`}
          scope={todayScope}
        />
        <section className="dashboard-grid analytics-primary-grid">
          <HourlyUsageChart
            data={todayScope.hourlyBreakdown}
            selectedDate={dashboard.todayDate}
            voiceSessions={todayScope.voiceSessionsForChart}
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
            onChangeMonth={(date) =>
              setVisibleMonth(date.toISOString().slice(0, 7))
            }
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
              Only dates with tracked data are clickable. Change the month and
              pick a valid date to load its history.
            </p>
            <ScopeMetrics
              detail={`History | ${dashboard.selectedDate}`}
              scope={historyScope}
            />
          </section>
        </section>
        <section className="dashboard-grid analytics-primary-grid">
          {state.historyLoading || !historyScopeReady ? (
            <>
              <SectionLoader
                copy="Rebuilding the hourly message and voice breakdown for the selected date."
                title="Loading historical analytics"
              />
              <SectionLoader
                copy="Refreshing the channel leaderboards for the selected day."
                title="Loading historical leaderboards"
              />
            </>
          ) : (
            <>
              <HourlyUsageChart
                data={historyScope.hourlyBreakdown}
                selectedDate={dashboard.selectedDate}
                voiceSessions={historyScope.voiceSessionsForChart}
              />
              <LeaderboardPanel
                chatChannels={historyScope.leaderboards.chatChannels}
                viewLabel={`History | ${dashboard.selectedDate}`}
                voiceChannels={historyScope.leaderboards.voiceChannels}
              />
            </>
          )}
        </section>
        {state.historyLoading || !historyScopeReady ? (
          <SectionLoader
            copy="Loading the tracked voice sessions and message history for the selected date."
            title="Loading activity log"
          />
        ) : (
          <ActivityDetailsPanel
            recentMessages={historyScope.recentMessages}
            recentVoiceSessions={historyScope.recentVoiceSessions}
          />
        )}
      </>
    );
  }

  function renderLifetimeChannel() {
    if (state.lifetimeLoading || !state.lifetimeLoaded) {
      return (
        <>
          <ChannelIntro
            channelName={activeChannelMeta.label}
            description="This combines all tracked Disclytics history, including today, so you can follow your long-term voice, messaging, and channel activity trends."
          />
          <SectionLoader
            copy="Loading lifetime trends, leaderboards, and heatmap data."
            title="Loading lifetime analytics"
          />
        </>
      );
    }

    return (
      <>
        <ChannelIntro
          channelName={activeChannelMeta.label}
          description="This combines all tracked Disclytics history, including today, so you can follow your long-term voice, messaging, and channel activity trends."
        />
        <EngagementKpiGrid
          summary={lifetimeScope.summary}
          trackedDayCount={lifetimeScope.trend?.length || 0}
          trackedStartDate={dashboard.trackedRange.firstActivityDate}
        />
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
          loadingReminders={state.remindersLoading}
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
              {state.user?.global_name ||
                state.user?.username ||
                "Disclytics User"}
            </h1>
          </div>
        </div>
        <div className="nav-actions">
          <button
            aria-label={
              theme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
            className="secondary-button icon-button"
            onClick={() =>
              setTheme((currentTheme) =>
                currentTheme === "dark" ? "light" : "dark",
              )
            }
            type="button"
          >
            {theme === "dark" ? (
              <FiSun aria-hidden="true" />
            ) : (
              <FiMoon aria-hidden="true" />
            )}
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
            onClick={() =>
              authApi.logout().then(() => {
                syncRouteForAuthState(false);
                window.location.reload();
              })
            }
            type="button"
          >
            <FiLogOut aria-hidden="true" />
          </button>
        </div>
      </nav>

      <div className="workspace-shell">
        <FeatureSidebar
          activeChannel={activeChannel}
          onSelectChannel={setActiveChannel}
        />

        <main className="channel-stage">
          <header className="channel-header">
            <div>
              <p className="channel-title">#{activeChannelMeta.label}</p>
              <p className="channel-subtitle">
                {activeChannelMeta.description}
              </p>
            </div>
            <p className="toolbar-caption">
              {formatRefreshTime(state.lastUpdatedAt)}
            </p>
          </header>

          <div className="channel-scroll">{renderChannelContent()}</div>
        </main>
      </div>
    </div>
  );
}
