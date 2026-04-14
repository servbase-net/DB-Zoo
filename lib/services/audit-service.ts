import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/lib/types/auth";
import { fallbackAddAudit } from "@/lib/services/fallback-store";

type AuditInput = {
  actorRole: AppRole;
  action: string;
  resourceType: string;
  resourceId: string;
  payload?: unknown;
};

export async function writeAuditLog(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorRole: input.actorRole,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        payload: input.payload ? JSON.stringify(input.payload) : null,
      },
    });
  } catch {
    fallbackAddAudit({
      actorRole: input.actorRole,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      payload: input.payload ? JSON.stringify(input.payload) : null,
    });
  }
}
