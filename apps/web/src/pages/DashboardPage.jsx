import { useEffect, useState } from "react";

import { analyticsApi, authApi, remindersApi } from "../api/client";
import { ActivityDetailsPanel } from "../components/ActivityDetailsPanel";
import { CoverageBanner } from "../components/CoverageBanner";
import { MetricCard } from "../components/MetricCard";
import { ReminderPanel } from "../components/ReminderPanel";
import { ActivityHeatmap } from "../components/charts/ActivityHeatmap";
import { ChannelPieChart } from "../components/charts/ChannelPieChart";
import { VoiceTrendChart } from "../components/charts/VoiceTrendChart";

const THEME_STORAGE_KEY = "disclytics-theme";
const DASHBOARD_REFRESH_MS = 30000;
const LIVE_VOICE_TICK_MS = 1000;

function formatVoiceSeconds(seconds) {
  const totalMinutes = Math.max(0, Math.round((seconds || 0) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatRefreshTime(value) {
  if (!value) {
    return "Refreshing every 30 seconds";
  }

  return `Last updated ${new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value))}`;
}

function applyLiveVoiceProgress(dashboard, lastUpdatedAt, nowTimestamp) {
  if (!dashboard || !lastUpdatedAt) {
    return dashboard;
  }

  const activeSessions = (dashboard.recentVoiceSessions || []).filter((session) => !session.endTime);

  if (!activeSessions.length) {
    return dashboard;
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((nowTimestamp - new Date(lastUpdatedAt).getTime()) / 1000)
  );

  if (elapsedSeconds <= 0) {
    return dashboard;
  }

  const liveExtraSeconds = activeSessions.length * elapsedSeconds;

  return {
    ...dashboard,
    summary: {
      ...dashboard.summary,
      totalVoiceSeconds: Number(dashboard.summary.totalVoiceSeconds || 0) + liveExtraSeconds
    },
    dailyTrend: (dashboard.dailyTrend || []).map((item, index, items) => (
      index === items.length - 1
        ? {
          ...item,
          totalVoiceSeconds: Number(item.totalVoiceSeconds || 0) + liveExtraSeconds
        }
        : item
    )),
    recentVoiceSessions: (dashboard.recentVoiceSessions || []).map((session) => (
      session.endTime
        ? session
        : {
          ...session,
          durationSeconds: Number(session.durationSeconds || 0) + elapsedSeconds
        }
    ))
  };
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

export function DashboardPage() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  const [state, setState] = useState({
    loading: true,
    authenticated: true,
    user: null,
    guilds: [],
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
        const [{ user, guilds, botInstallUrl }, dashboard, { reminders }] = await Promise.all([
          authApi.getCurrentUser(),
          analyticsApi.getDashboard(7),
          remindersApi.list()
        ]);

        if (!active) {
          return;
        }

        setState({
          loading: false,
          authenticated: true,
          user,
          guilds: Array.isArray(guilds) ? guilds : [],
          botInstallUrl: botInstallUrl || null,
          dashboard,
          reminders,
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
            guilds: [],
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

    load();
    const intervalId = window.setInterval(load, DASHBOARD_REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  if (state.loading) {
    return <div className="shell"><div className="hero-card">Loading Disclytics...</div></div>;
  }

  if (!state.authenticated) {
    return (
      <div className="shell">
        <section className="hero-card">
          <div className="hero-copy">
            <p className="eyebrow">Disclytics</p>
            <h1>Disclytics tracks activity only where your bot is actually present</h1>
            <p>
              Messages, voice sessions, reminder delivery, and dashboard analytics stay inside the
              servers your community has explicitly connected.
            </p>
          </div>
          <div className="action-panel">
            <p className="eyebrow">Workspace</p>
            <div className="header-actions">
              <button
                className="secondary-button"
                onClick={() => setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark")}
                type="button"
              >
                {theme === "dark" ? "Switch to light" : "Switch to dark"}
              </button>
              <a className="primary-button" href={authApi.getLoginUrl()}>
                Login with Discord
              </a>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (state.error) {
    return <div className="shell"><div className="hero-card">Failed to load dashboard: {state.error}</div></div>;
  }

  const dashboard = applyLiveVoiceProgress(state.dashboard, state.lastUpdatedAt, nowTimestamp);

  return (
    <div className="shell">
      <header className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Disclytics</p>
          <h1>{state.user?.global_name || state.user?.username}'s activity dashboard</h1>
          <p>
            Analytics reflect only servers where the bot is installed. That keeps the product within
            Discord's rules and makes coverage explicit instead of implied.
          </p>
        </div>
        <div className="action-panel">
          <p className="eyebrow">Workspace</p>
          <div className="header-actions">
            <button
              className="secondary-button"
              onClick={() => setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark")}
              type="button"
            >
              {theme === "dark" ? "Switch to light" : "Switch to dark"}
            </button>
            {state.botInstallUrl ? (
              <a className="primary-button" href={state.botInstallUrl} rel="noreferrer" target="_blank">
                Invite bot
              </a>
            ) : null}
            <button className="secondary-button" onClick={() => authApi.logout().then(() => window.location.reload())} type="button">
              Logout
            </button>
          </div>
          <p className="toolbar-caption">{formatRefreshTime(state.lastUpdatedAt)}</p>
        </div>
      </header>

      <CoverageBanner coverage={dashboard.coverage} />

      <section className="metric-grid">
        <MetricCard
          label="Messages"
          value={dashboard.summary.totalMessages}
          detail="Last 7 tracked days"
        />
        <MetricCard
          label="Voice time"
          value={formatVoiceSeconds(dashboard.summary.totalVoiceSeconds)}
          detail="Across tracked guild sessions"
        />
        <MetricCard
          label="Most active channel"
          value={dashboard.summary.mostActiveChannelName || "N/A"}
          detail={`${dashboard.summary.mostActiveChannelCount} tracked events`}
        />
      </section>

      <ActivityDetailsPanel
        recentMessages={dashboard.recentMessages}
        recentVoiceSessions={dashboard.recentVoiceSessions}
      />

      <section className="dashboard-grid">
        <VoiceTrendChart data={dashboard.dailyTrend} />
        <ChannelPieChart data={dashboard.channelDistribution} />
        <ActivityHeatmap data={dashboard.heatmap} />
        <ReminderPanel reminders={state.reminders} />
      </section>
    </div>
  );
}
