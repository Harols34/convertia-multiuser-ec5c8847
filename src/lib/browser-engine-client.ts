export interface BrowserSessionTab {
  id: string;
  title: string;
  url: string;
  status: "idle" | "loading" | "loaded" | "blocked" | "error";
  reason: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  isActive: boolean;
}

export interface BrowserSessionSnapshot {
  id: string;
  activeTabId: string | null;
  browserConfigId: string;
  tabs: BrowserSessionTab[];
}

type SessionResponse = {
  session: BrowserSessionSnapshot;
};

const BASE_URL =
  (import.meta.env.VITE_BROWSER_ENGINE_URL as string | undefined)?.replace(/\/$/, "") ||
  "/api/browser-engine";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let message = "No se pudo completar la operacion del navegador.";
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // Ignore JSON parse errors.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const browserEngineClient = {
  createSession: async (payload: {
    companyId: string;
    userId: string;
    browserConfigId: string;
  }) => {
    const response = await request<SessionResponse>("/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.session;
  },
  getSession: async (sessionId: string) => {
    const response = await request<SessionResponse>(`/sessions/${sessionId}`);
    return response.session;
  },
  destroySession: async (sessionId: string) => {
    await request<void>(`/sessions/${sessionId}`, { method: "DELETE" });
  },
  createTab: async (sessionId: string, url?: string) => {
    const response = await request<SessionResponse>(`/sessions/${sessionId}/tabs`, {
      method: "POST",
      body: JSON.stringify(url ? { url } : {}),
    });
    return response.session;
  },
  closeTab: async (sessionId: string, tabId: string) => {
    const response = await request<SessionResponse>(`/sessions/${sessionId}/tabs/${tabId}`, {
      method: "DELETE",
    });
    return response.session;
  },
  activateTab: async (sessionId: string, tabId: string) => {
    const response = await request<SessionResponse>(`/sessions/${sessionId}/activate`, {
      method: "POST",
      body: JSON.stringify({ tabId }),
    });
    return response.session;
  },
  navigate: async (sessionId: string, tabId: string, url: string) => {
    const response = await request<SessionResponse>(
      `/sessions/${sessionId}/tabs/${tabId}/navigate`,
      {
        method: "POST",
        body: JSON.stringify({ url }),
      }
    );
    return response.session;
  },
  back: async (sessionId: string, tabId: string) => {
    const response = await request<SessionResponse>(`/sessions/${sessionId}/tabs/${tabId}/back`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    return response.session;
  },
  forward: async (sessionId: string, tabId: string) => {
    const response = await request<SessionResponse>(
      `/sessions/${sessionId}/tabs/${tabId}/forward`,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
    return response.session;
  },
  reload: async (sessionId: string, tabId: string) => {
    const response = await request<SessionResponse>(
      `/sessions/${sessionId}/tabs/${tabId}/reload`,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
    return response.session;
  },
  click: async (sessionId: string, tabId: string, xRatio: number, yRatio: number) => {
    const response = await request<SessionResponse>(
      `/sessions/${sessionId}/tabs/${tabId}/click`,
      {
        method: "POST",
        body: JSON.stringify({ xRatio, yRatio }),
      }
    );
    return response.session;
  },
  scroll: async (sessionId: string, tabId: string, deltaY: number) => {
    const response = await request<SessionResponse>(
      `/sessions/${sessionId}/tabs/${tabId}/scroll`,
      {
        method: "POST",
        body: JSON.stringify({ deltaY }),
      }
    );
    return response.session;
  },
  type: async (sessionId: string, tabId: string, text: string) => {
    const response = await request<SessionResponse>(
      `/sessions/${sessionId}/tabs/${tabId}/type`,
      {
        method: "POST",
        body: JSON.stringify({ text }),
      }
    );
    return response.session;
  },
  press: async (sessionId: string, tabId: string, key: string) => {
    const response = await request<SessionResponse>(
      `/sessions/${sessionId}/tabs/${tabId}/press`,
      {
        method: "POST",
        body: JSON.stringify({ key }),
      }
    );
    return response.session;
  },
  getSnapshotUrl: (
    sessionId: string,
    tabId: string,
    token: number,
    options?: { format?: "png" | "jpeg"; quality?: number }
  ) => {
    const search = new URLSearchParams({
      t: String(token),
      format: options?.format || "jpeg",
    });

    if (options?.format !== "png" && options?.quality) {
      search.set("quality", String(options.quality));
    }

    return `${BASE_URL}/sessions/${sessionId}/tabs/${tabId}/snapshot?${search.toString()}`;
  },
};
