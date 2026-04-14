"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type WorkspaceTab = {
  id: string;
  label: string;
  href: string;
  pinned?: boolean;
};

const KEY = "dbzoo.workspaceTabs";
const EVENT_NAME = "dbzoo:workspace-tabs-changed";
const MAX_RECENT_TABLE_TABS = 10;

const BASE_TABS: WorkspaceTab[] = [
  { id: "query", label: "Query", href: "/query", pinned: true },
];

function isTableTab(tab: WorkspaceTab) {
  return tab.id.startsWith("table:") && tab.href.startsWith("/tables/");
}

function readTabs() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return BASE_TABS;
    const parsed = JSON.parse(raw) as WorkspaceTab[];
    const merged = [...BASE_TABS];
    const tableTabs = parsed.filter((tab) => isTableTab(tab)).slice(0, MAX_RECENT_TABLE_TABS);
    for (const tab of tableTabs) {
      if (!merged.some((item) => item.id === tab.id)) merged.push(tab);
    }
    return merged;
  } catch {
    return BASE_TABS;
  }
}

function writeTabs(tabs: WorkspaceTab[]) {
  localStorage.setItem(KEY, JSON.stringify(tabs));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function useWorkspaceTabs(currentTable: { database: string; schema: string; table: string; href: string }) {
  const [tabs, setTabs] = useState<WorkspaceTab[]>(BASE_TABS);

  const currentTableTab = useMemo<WorkspaceTab>(
    () => ({
      id: `table:${currentTable.database}.${currentTable.schema}.${currentTable.table}`,
      label: currentTable.table,
      href: currentTable.href,
    }),
    [currentTable.database, currentTable.schema, currentTable.table, currentTable.href],
  );

  useEffect(() => {
    setTabs(readTabs());
    const onChange = () => setTabs(readTabs());
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY) onChange();
    };
    window.addEventListener(EVENT_NAME, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    setTabs((prev) => {
      const pinnedTabs = prev.filter((tab) => tab.pinned);
      const existingRecent = prev.filter((tab) => !tab.pinned && tab.id !== currentTableTab.id && isTableTab(tab));
      const next = [...pinnedTabs, currentTableTab, ...existingRecent].slice(0, pinnedTabs.length + MAX_RECENT_TABLE_TABS);
      writeTabs(next);
      return next;
    });
  }, [currentTableTab]);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const target = prev.find((tab) => tab.id === id);
      if (target?.pinned) return prev;
      const next = prev.filter((tab) => tab.id !== id);
      writeTabs(next);
      return next;
    });
  }, []);

  return { tabs, currentTableTab, closeTab };
}
