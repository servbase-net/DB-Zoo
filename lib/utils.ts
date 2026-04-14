import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getDefaultPort(engine: string) {
  switch (engine) {
    case "mysql":
    case "mariadb":
      return 3306;
    case "postgresql":
      return 5432;
    case "sqlite":
      return 0;
    default:
      return 0;
  }
}
