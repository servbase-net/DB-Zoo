/** Text shown in a table cell. JSON/jsonb arrive as objects and must not print as [object Object]. */
export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Result rows as CSV text (RFC 4180 quoting). */
export function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const cell = (value: unknown) => {
    const text = formatCell(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [columns.map(cell).join(","), ...rows.map((row) => columns.map((c) => cell(row[c])).join(","))].join("\n");
}
