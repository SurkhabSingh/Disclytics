import { queryOptions } from "@tanstack/react-query";

import { analyticsApi, authApi, getBrowserTimezone, remindersApi } from "./client";
import {
  normalizeHistoryPayload,
  normalizeLifetimePayload,
  normalizeOverviewPayload,
} from "../features/analytics/dashboardModel";

export const dashboardQueryKeys = {
  history: (selectedDate, timezone) => ["analytics", "history", selectedDate, timezone],
  lifetime: (timezone) => ["analytics", "lifetime", timezone],
  overview: (timezone) => ["analytics", "overview", timezone],
  reminders: () => ["reminders"],
  session: () => ["auth", "session"],
};

export const dashboardQueryStaleTimes = {
  history: 10 * 60 * 1000,
  lifetime: 2 * 60 * 1000,
  overview: 45 * 1000,
  reminders: 30 * 1000,
  session: 60 * 1000,
};

async function getCurrentSession({ signal } = {}) {
  try {
    const { botInstallUrl = null, user = null } = await authApi.getCurrentUser({
      signal,
    });
    return {
      authenticated: true,
      botInstallUrl,
      user,
    };
  } catch (error) {
    if (error?.status === 401) {
      return {
        authenticated: false,
        botInstallUrl: null,
        user: null,
      };
    }

    throw error;
  }
}

export function getDashboardTimezone() {
  return getBrowserTimezone();
}

export function getSessionQueryOptions() {
  return queryOptions({
    gcTime: 15 * 60 * 1000,
    queryFn: ({ signal }) => getCurrentSession({ signal }),
    queryKey: dashboardQueryKeys.session(),
    staleTime: dashboardQueryStaleTimes.session,
  });
}

export function getOverviewQueryOptions(timezone) {
  return queryOptions({
    gcTime: 15 * 60 * 1000,
    queryFn: async ({ signal }) =>
      normalizeOverviewPayload(
        await analyticsApi.getOverview(null, { signal }),
      ),
    queryKey: dashboardQueryKeys.overview(timezone),
    staleTime: dashboardQueryStaleTimes.overview,
  });
}

export function getHistoryQueryOptions(selectedDate, timezone) {
  return queryOptions({
    gcTime: 30 * 60 * 1000,
    queryFn: async ({ signal }) =>
      normalizeHistoryPayload(
        await analyticsApi.getHistory(selectedDate, { signal }),
      ),
    queryKey: dashboardQueryKeys.history(selectedDate, timezone),
    staleTime: dashboardQueryStaleTimes.history,
  });
}

export function getLifetimeQueryOptions(timezone) {
  return queryOptions({
    gcTime: 15 * 60 * 1000,
    queryFn: async ({ signal }) =>
      normalizeLifetimePayload(await analyticsApi.getLifetime({ signal })),
    queryKey: dashboardQueryKeys.lifetime(timezone),
    staleTime: dashboardQueryStaleTimes.lifetime,
  });
}

export function getRemindersQueryOptions() {
  return queryOptions({
    gcTime: 10 * 60 * 1000,
    queryFn: async ({ signal }) => {
      const response = await remindersApi.list({ signal });
      return Array.isArray(response?.reminders) ? response.reminders : [];
    },
    queryKey: dashboardQueryKeys.reminders(),
    staleTime: dashboardQueryStaleTimes.reminders,
  });
}
