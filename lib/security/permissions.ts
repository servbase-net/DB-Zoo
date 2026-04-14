import type { AppRole } from "@/lib/types/auth";

const roleRank: Record<AppRole, number> = {
  read_only: 0,
  operator: 1,
  admin: 2,
};

export function hasPermission(actor: AppRole, minimum: AppRole) {
  return roleRank[actor] >= roleRank[minimum];
}

export function assertPermission(actor: AppRole, minimum: AppRole) {
  if (!hasPermission(actor, minimum)) {
    throw new Error(`Forbidden: requires ${minimum} role`);
  }
}
