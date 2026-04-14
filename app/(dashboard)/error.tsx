"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
      <h2 className="font-semibold text-destructive">Dashboard load failed</h2>
      <p className="text-sm">{error.message}</p>
      <Button variant="outline" onClick={() => reset()}>
        Retry
      </Button>
    </div>
  );
}
