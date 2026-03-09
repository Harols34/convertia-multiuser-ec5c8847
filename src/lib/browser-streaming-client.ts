import type {
  CreateRemoteBrowserSessionInput,
  RemoteBrowserHealthResponse,
  RemoteBrowserSessionResponse,
  RemoteBrowserStreamingSession,
} from "../../browser-engine-streaming/contracts";

const BASE_URL =
  (import.meta.env.VITE_BROWSER_STREAMING_ENGINE_URL as string | undefined)?.replace(/\/$/, "") ||
  "/api/browser-streaming";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let message = "No se pudo completar la operacion del navegador remoto.";

    try {
      const body = await response.json();
      if (body?.error) {
        message = body.error;
      }
    } catch {
      // Ignora errores de parseo.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const browserStreamingClient = {
  getHealth: async () => {
    return request<RemoteBrowserHealthResponse>("/health");
  },
  createSession: async (payload: CreateRemoteBrowserSessionInput) => {
    const response = await request<RemoteBrowserSessionResponse>("/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return response.session;
  },
  getSession: async (sessionId: string) => {
    const response = await request<RemoteBrowserSessionResponse>(`/sessions/${sessionId}`);
    return response.session;
  },
  destroySession: async (sessionId: string) => {
    await request<void>(`/sessions/${sessionId}`, {
      method: "DELETE",
    });
  },
};

export type { RemoteBrowserHealthResponse, RemoteBrowserStreamingSession };
