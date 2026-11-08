/** Parses the row filter box. Only `column=value` is supported; anything else matches all rows. */
export function parseColumnFilter(filter?: string): { column: string; value: string } | null {
  const match = filter?.trim().match(/^([^=]+?)\s*=\s*(.*)$/);
  return match ? { column: match[1], value: match[2] } : null;
}
