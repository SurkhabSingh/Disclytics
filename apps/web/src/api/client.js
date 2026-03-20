const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || "Request failed");
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export const authApi = {
  getLoginUrl() {
    return `${API_BASE_URL}/api/auth/discord/start`;
  },
  getCurrentUser() {
    return request("/api/auth/me");
  },
  logout() {
    return request("/api/auth/logout", { method: "POST" });
  }
};

export const analyticsApi = {
  getDashboard(days = 7) {
    return request(`/api/analytics/dashboard?days=${days}`);
  }
};

export const remindersApi = {
  list() {
    return request("/api/reminders");
  }
};
