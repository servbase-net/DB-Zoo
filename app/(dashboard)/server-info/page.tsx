import { ServerInfoPanel } from "@/components/db-manager/server-info";

export default function ServerInfoPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Server Info</h1>
        <p className="text-sm text-muted-foreground">Connection metadata and engine capabilities.</p>
      </div>
      <ServerInfoPanel />
    </div>
  );
}
