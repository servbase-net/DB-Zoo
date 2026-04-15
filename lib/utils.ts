import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDefaultPort(engine: string): number {
  switch (engine) {
    case "postgresql":
      return 5432;
    case "mysql":
    case "mariadb":
      return 3306;
    default:
      return 0;
  }
}