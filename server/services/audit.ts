import { createHash } from "node:crypto";
import { prisma } from "../db";

export async function audit(actorUserId: string | undefined, action: string, entity: string, entityId: string | undefined, details: string) {
  const createdAt = new Date();
  const previous = await prisma.auditLog.findFirst({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  const prevHash = previous?.entryHash ?? "GENESIS";
  const entryHash = auditHash(prevHash, actorUserId, action, entity, entityId, details, createdAt);
  await prisma.auditLog.create({
    data: {
      actorUserId,
      action,
      entity,
      entityId,
      details,
      prevHash,
      entryHash,
      createdAt
    }
  });
}

function auditHash(prevHash: string, actorUserId: string | undefined, action: string, entity: string, entityId: string | undefined, details: string, createdAt: Date) {
  return createHash("sha256")
    .update([prevHash, actorUserId ?? "", action, entity, entityId ?? "", details, createdAt.toISOString()].join("|"))
    .digest("hex");
}

export function verifyAuditChain(rows: Array<{ prevHash: string; entryHash: string; actorUserId: string | null; action: string; entity: string; entityId: string | null; details: string; createdAt: Date }>) {
  let expectedPrev = "GENESIS";
  for (const row of rows) {
    const expectedHash = auditHash(expectedPrev, row.actorUserId ?? undefined, row.action, row.entity, row.entityId ?? undefined, row.details, row.createdAt);
    if (row.prevHash !== expectedPrev || row.entryHash !== expectedHash) return false;
    expectedPrev = row.entryHash;
  }
  return true;
}
