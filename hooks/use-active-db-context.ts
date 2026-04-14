"use client";

import { useCallback, useEffect, useState } from "react";

const DB_KEY = "dbzoo.activeDatabase";
const SCHEMA_KEY = "dbzoo.activeSchema";
const EVENT_NAME = "dbzoo:db-context-changed";

function readDatabase() {
  return localStorage.getItem(DB_KEY) ?? "";
}

function readSchema() {
  return localStorage.getItem(SCHEMA_KEY) ?? "";
}

function emitContextChanged() {
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function useActiveDbContext() {
  const [database, setDatabaseState] = useState("");
  const [schema, setSchemaState] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setDatabaseState(readDatabase());
    setSchemaState(readSchema());
    setIsReady(true);

    const onStorage = (event: StorageEvent) => {
      if (event.key === DB_KEY || event.key === SCHEMA_KEY) {
        setDatabaseState(readDatabase());
        setSchemaState(readSchema());
      }
    };

    const onChanged = () => {
      setDatabaseState(readDatabase());
      setSchemaState(readSchema());
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT_NAME, onChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT_NAME, onChanged);
    };
  }, []);

  const setDatabase = useCallback((value: string) => {
    localStorage.setItem(DB_KEY, value);
    setDatabaseState(value);
    emitContextChanged();
  }, []);

  const setSchema = useCallback((value: string) => {
    localStorage.setItem(SCHEMA_KEY, value);
    setSchemaState(value);
    emitContextChanged();
  }, []);

  const setContext = useCallback((next: { database?: string; schema?: string }) => {
    if (typeof next.database === "string") {
      localStorage.setItem(DB_KEY, next.database);
      setDatabaseState(next.database);
    }
    if (typeof next.schema === "string") {
      localStorage.setItem(SCHEMA_KEY, next.schema);
      setSchemaState(next.schema);
    }
    emitContextChanged();
  }, []);

  return { database, schema, setDatabase, setSchema, setContext, isReady };
}
