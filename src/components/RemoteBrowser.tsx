import { EmbeddedBrowser } from "@/components/EmbeddedBrowser";
import { EmbeddedBrowserStreaming } from "@/components/EmbeddedBrowserStreaming";

interface RemoteBrowserProps {
  companyId: string;
  userId: string;
}

const browserMode = (import.meta.env.VITE_EMBEDDED_BROWSER_MODE as
  | "snapshots"
  | "streaming"
  | "hybrid"
  | undefined) || (import.meta.env.DEV ? "snapshots" : "hybrid");

export function RemoteBrowser({ companyId, userId }: RemoteBrowserProps) {
  if (browserMode === "snapshots") {
    return <EmbeddedBrowser companyId={companyId} userId={userId} />;
  }

  return (
    <EmbeddedBrowserStreaming
      companyId={companyId}
      userId={userId}
      mode={browserMode === "streaming" ? "streaming" : "hybrid"}
      fallback={<EmbeddedBrowser companyId={companyId} userId={userId} />}
    />
  );
}
