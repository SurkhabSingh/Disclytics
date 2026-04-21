const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const API_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_REQUEST_TIMEOUT_MS || 8000);
const DEFAULT_SAFE_GET_RETRIES = 1;
const RETRYABLE_METHODS = new Set(["GET", "HEAD"]);

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function isRetryableRequest(method, error, externalSignal) {
  if (!RETRYABLE_METHODS.has(method) || externalSignal?.aborted) {
    return false;
  }

  if (error?.name === "TimeoutError") {
    return true;
  }

  return error instanceof TypeError;
}

async function requestOnce(path, options = {}) {
  const controller = new AbortController();
  const externalSignal = options.signal;
  const timeoutMs = Number(options.timeoutMs ?? API_REQUEST_TIMEOUT_MS);
  const {
    retryCount: _retryCount,
    signal: _signal,
    timeoutMs: _timeoutMs,
    ...fetchOptions
  } = options;
  let timeoutId = null;
  let timedOut = false;

  function abortFromExternalSignal() {
    controller.abort();
  }

  if (externalSignal?.aborted) {
    controller.abort();
  } else if (externalSignal) {
    externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
  }

  if (timeoutMs > 0) {
    timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(fetchOptions.headers || {})
      },
      ...fetchOptions,
      signal: controller.signal
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
  } catch (error) {
    if (error?.name === "AbortError" && timedOut) {
      const timeoutError = new Error("Request timed out");
      timeoutError.name = "TimeoutError";
      throw timeoutError;
    }

    throw error;
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }

    if (externalSignal) {
      externalSignal.removeEventListener("abort", abortFromExternalSignal);
    }
  }
}

async function request(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const retryCount = Number(
    options.retryCount ?? (RETRYABLE_METHODS.has(method) ? DEFAULT_SAFE_GET_RETRIES : 0)
  );
  let attempt = 0;

  while (true) {
    try {
      return await requestOnce(path, {
        ...options,
        method
      });
    } catch (error) {
      if (attempt >= retryCount || !isRetryableRequest(method, error, options.signal)) {
        throw error;
      }

      attempt += 1;
    }
  }
}

export const authApi = {
  getInstallUrl() {
    return `${API_BASE_URL}/api/auth/discord/install`;
  },
  getLoginUrl() {
    return `${API_BASE_URL}/api/auth/discord/start`;
  },
  getCurrentUser(options = {}) {
    return request("/api/auth/me", options);
  },
  logout() {
    return request("/api/auth/logout", { method: "POST" });
  }
};

export const analyticsApi = {
  getDashboard(selectedDate = null, options = {}) {
    const params = new URLSearchParams();
    const timezone = getBrowserTimezone();

    if (selectedDate) {
      params.set("selectedDate", selectedDate);
    }

    if (timezone) {
      params.set("timezone", timezone);
    }

    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request(`/api/analytics/dashboard${suffix}`, options);
  },
  getOverview(selectedDate = null, options = {}) {
    const params = new URLSearchParams();
    const timezone = getBrowserTimezone();

    if (selectedDate) {
      params.set("selectedDate", selectedDate);
    }

    if (timezone) {
      params.set("timezone", timezone);
    }

    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request(`/api/analytics/overview${suffix}`, options);
  },
  getHistory(selectedDate = null, options = {}) {
    const params = new URLSearchParams();
    const timezone = getBrowserTimezone();

    if (selectedDate) {
      params.set("selectedDate", selectedDate);
    }

    if (timezone) {
      params.set("timezone", timezone);
    }

    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request(`/api/analytics/history${suffix}`, options);
  },
  getLifetime(options = {}) {
    const params = new URLSearchParams();
    const timezone = getBrowserTimezone();

    if (timezone) {
      params.set("timezone", timezone);
    }

    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request(`/api/analytics/lifetime${suffix}`, options);
  }
};

export const remindersApi = {
  list(options = {}) {
    return request("/api/reminders", options);
  },
  create(payload) {
    return request("/api/reminders", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};
