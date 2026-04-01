const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
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
    error.details = payload.details || null;
    error.requestId = payload.requestId || null;
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
  getDashboard(selectedDate = null) {
    const params = new URLSearchParams();

    if (selectedDate) {
      params.set("selectedDate", selectedDate);
    }

    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request(`/api/analytics/dashboard${suffix}`);
  }
};

export const remindersApi = {
  list() {
    return request("/api/reminders");
  },
  create(payload) {
    return request("/api/reminders", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};
