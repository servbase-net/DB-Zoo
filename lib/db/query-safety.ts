const destructiveRegex =
  /\b(drop|truncate|delete\s+from|alter\s+table|update\s+\w+\s+set)\b/i;

export function classifyQueryRisk(query: string) {
  return destructiveRegex.test(query) ? "destructive" : "safe";
}
