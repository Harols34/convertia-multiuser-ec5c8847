export type RemoteBrowserSessionStatus =
  | "provisioning"
  | "ready"
  | "error"
  | "closed";

export interface RemoteBrowserSessionTab {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

export interface RemoteBrowserStreamingSession {
  id: string;
  browserConfigId: string;
  companyId: string;
  userId: string;
  status: RemoteBrowserSessionStatus;
  streamUrl: string | null;
  controlUrl: string | null;
  tabs: RemoteBrowserSessionTab[];
  activeTabId: string | null;
  homeUrl: string | null;
  error: string | null;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRemoteBrowserSessionInput {
  companyId: string;
  userId: string;
  browserConfigId: string;
}

export interface RemoteBrowserSessionResponse {
  session: RemoteBrowserStreamingSession;
}

export interface RemoteBrowserDependencyStatus {
  name: string;
  command: string;
  available: boolean;
  resolvedPath: string | null;
  required: boolean;
}

export interface RemoteBrowserHealthResponse {
  ok: boolean;
  mode: "streaming";
  ready: boolean;
  message: string;
  dependencies: RemoteBrowserDependencyStatus[];
}
