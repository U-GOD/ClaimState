"use client";

import { useEffect, useState } from "react";

export function IndexStatus({ sequence }: { sequence: string }) {
  const [status, setStatus] = useState("pending");

  useEffect(() => {
    let stopped = false;
    async function poll(): Promise<void> {
      const response = await fetch(`/api/mirror?sequence=${sequence}`);
      if (!response.ok || stopped) {
        return;
      }
      const body = (await response.json()) as { status?: string };
      const next = body.status === "resolved" ? "resolved" : "pending";
      setStatus(next);
      if (next === "pending") {
        window.setTimeout(() => {
          void poll();
        }, 400);
      }
    }
    void poll();
    return () => {
      stopped = true;
    };
  }, [sequence]);

  return (
    <p className={status} data-index-status={status}>
      Index status: {status === "pending" ? "pending index" : "resolved"}
    </p>
  );
}
