import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardPage } from "../src/pages/DashboardPage";

vi.mock("../src/api/client", () => ({
  analyticsApi: {
    getDashboard: vi.fn()
  },
  authApi: {
    getCurrentUser: vi.fn(),
    getLoginUrl: () => "/login",
    logout: () => Promise.resolve()
  },
  remindersApi: {
    create: vi.fn(),
    list: vi.fn()
  }
}));

const { analyticsApi, authApi, remindersApi } = await import("../src/api/client");

function createDashboardFixture() {
  return {
    availableDates: ["2026-04-01"],
    coverage: { accessibleGuilds: 1, trackedGuilds: 1, percent: 100 },
    heatmap: [],
    scopes: {
      history: {
        date: "2026-04-01",
        hourlyBreakdown: [],
        leaderboards: { chatChannels: [], voiceChannels: [] },
        recentMessages: [],
        recentVoiceSessions: [],
        summary: {
          mostActiveChannelCount: 0,
          mostActiveChannelId: null,
          mostActiveChannelName: null,
          totalMessages: 4,
          totalVoiceSeconds: 600
        }
      },
      lifetime: {
        comparison: {
          peers: {
            daily: [],
            lifetime: []
          },
          recentWindowDays: 7,
          trackedDayCount: 1
        },
        leaderboards: { chatChannels: [], voiceChannels: [] },
        recentMessages: [],
        recentVoiceSessions: [],
        summary: {
          mostActiveChannelCount: 0,
          mostActiveChannelId: null,
          mostActiveChannelName: null,
          totalMessages: 4,
          totalVoiceSeconds: 600
        },
        trend: [{ date: "2026-04-01", totalMessages: 4, totalVoiceSeconds: 600 }]
      },
      today: {
        date: "2026-04-01",
        hourlyBreakdown: [],
        leaderboards: { chatChannels: [], voiceChannels: [] },
        recentMessages: [],
        recentVoiceSessions: [],
        summary: {
          mostActiveChannelCount: 0,
          mostActiveChannelId: null,
          mostActiveChannelName: null,
          totalMessages: 4,
          totalVoiceSeconds: 600
        }
      }
    },
    selectedDate: "2026-04-01",
    todayDate: "2026-04-01",
    trackedRange: {
      firstActivityDate: "2026-04-01",
      lastActivityDate: "2026-04-01"
    }
  };
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    remindersApi.list.mockResolvedValue({ reminders: [] });
    analyticsApi.getDashboard.mockResolvedValue(createDashboardFixture());
  });

  it("renders the authenticated dashboard shell", async () => {
    authApi.getCurrentUser.mockResolvedValue({
      botInstallUrl: null,
      guilds: [],
      user: {
        global_name: "Disclytics Tester",
        username: "tester"
      }
    });

    render(<DashboardPage />);

    expect(await screen.findByText("Disclytics Tester")).toBeInTheDocument();
    expect(screen.getAllByText("#today's activity")).toHaveLength(2);
    expect(screen.getByText("Live activity, channels you used today, and a simple hourly graph.")).toBeInTheDocument();
    expect(screen.getByText("Here is everything Disclytics has tracked for you today so far, including your current live voice time.")).toBeInTheDocument();
  });

  it("renders the login state when unauthenticated", async () => {
    const error = new Error("Unauthorized");
    error.status = 401;
    authApi.getCurrentUser.mockRejectedValue(error);

    render(<DashboardPage />);

    expect(await screen.findByText("Discord activity, made honest.")).toBeInTheDocument();
    expect(screen.getByLabelText("Login with Discord")).toBeInTheDocument();
  });
});
