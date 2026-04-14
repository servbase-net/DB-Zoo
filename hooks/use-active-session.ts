"use client";

import { useEffect, useState } from "react";

const KEY = "dbzoo.activeSessionId";
const LEGACY_KEY = "servbase.activeSessionId";

export function useActiveSession() {
  const [sessionId, setSessionId] = useState<string>("");
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    const current = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY) ?? "";
    setSessionId(current);
    if (current && !localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, current);
    }
    setIsReady(true);
  }, []);
  const update = (value: string) => {
    if (!value) {
      localStorage.removeItem(KEY);
      localStorage.removeItem(LEGACY_KEY);
      setSessionId("");
      return;
    }
    localStorage.setItem(KEY, value);
    localStorage.removeItem(LEGACY_KEY);
    setSessionId(value);
  };
  const clearSession = () => update("");
  return { sessionId, setSessionId: update, clearSession, isReady };
}
