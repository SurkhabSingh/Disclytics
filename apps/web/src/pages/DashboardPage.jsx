import { useEffect, useState } from "react";

import { analyticsApi, authApi, remindersApi } from "../api/client";
import { CoverageBanner } from "../components/CoverageBanner";
import { MetricCard } from "../components/MetricCard";
import { ReminderPanel } from "../components/ReminderPanel";
import { ActivityHeatmap } from "../components/charts/ActivityHeatmap";
import { ChannelPieChart } from "../components/charts/ChannelPieChart";
import { VoiceTrendChart } from "../components/charts/VoiceTrendChart";

function formatVoiceSeconds(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function DashboardPage() {
  const [state, setState] = useState({
    loading: true,
    authenticated: true,
    user: null,
    dashboard: null,
    reminders: [],
    error: null
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [{ user }, dashboard, { reminders }] = await Promise.all([
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
          dashboard,
          reminders,
          error: null
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
            dashboard: null,
            reminders: [],
            error: null
          });
          return;
        }

        setState((previous) => ({
          ...previous,
          loading: false,
          error: error.message
        }));
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  if (state.loading) {
    return <div className="shell"><div className="hero-card">Loading analytics platform...</div></div>;
  }

  if (!state.authenticated) {
    return (
      <div className="shell">
        <section className="hero-card">
          <p className="eyebrow">Discord Activity Analytics Platform</p>
          <h1>Measure activity only where your bot is actually present</h1>
          <p>
            Messages, voice sessions, reminder delivery, and dashboard analytics stay inside the
            servers your community has explicitly connected.
          </p>
          <a className="primary-button" href={authApi.getLoginUrl()}>
            Login with Discord
          </a>
        </section>
      </div>
    );
  }

  if (state.error) {
    return <div className="shell"><div className="hero-card">Failed to load dashboard: {state.error}</div></div>;
  }

  const { dashboard } = state;

  return (
    <div className="shell">
      <header className="hero-card">
        <div>
          <p className="eyebrow">Saving Grace</p>
          <h1>{state.user?.global_name || state.user?.username}'s activity dashboard</h1>
          <p>
            Analytics reflect only servers where the bot is installed. That keeps the product within
            Discord’s rules and makes coverage explicit instead of implied.
          </p>
        </div>
        <button className="secondary-button" onClick={() => authApi.logout().then(() => window.location.reload())}>
          Logout
        </button>
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
          value={dashboard.summary.mostActiveChannelId || "N/A"}
          detail={`${dashboard.summary.mostActiveChannelCount} tracked events`}
        />
      </section>

      <section className="dashboard-grid">
        <VoiceTrendChart data={dashboard.dailyTrend} />
        <ChannelPieChart data={dashboard.channelDistribution} />
        <ActivityHeatmap data={dashboard.heatmap} />
        <ReminderPanel reminders={state.reminders} />
      </section>
    </div>
  );
}
