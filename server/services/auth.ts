import type { Request, Response } from "express";
import { prisma } from "../db";
import { audit } from "./audit";

export type Role = "EV_DRIVER" | "STATION_OPERATOR" | "ADMINISTRATOR";

export function roleFromRequest(req: Request): Role {
  return (req.header("x-demo-role") ?? "EV_DRIVER") as Role;
}

export function userIdFromRequest(req: Request) {
  return req.header("x-demo-user-id") ?? "user-driver";
}
export async function authorizeRequest(req: Request, res: Response, options: { roles?: Role[]; role?: Role; userId?: string } = {}) {
  const role = roleFromRequest(req);
  const actorUserId = userIdFromRequest(req);
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });

  if (!actor || !actor.isActive) {
    await audit(actor?.id, "UNAUTHORIZED_ACCESS_BLOCKED", req.path, undefined, `Inactive or unknown user ${actorUserId} attempted a protected endpoint.`);
    res.status(403).json({ error: "Inactive or unknown user." });
    return null;
  }

  if (actor.role !== role) {
    await audit(actor.id, "UNAUTHORIZED_ACCESS_BLOCKED", req.path, undefined, `Authenticated user role ${actor.role} did not match requested demo role ${role}.`);
    res.status(403).json({ error: "Role header does not match authenticated user." });
    return null;
  }

  if (options.roles && !options.roles.includes(role)) {
    await audit(actor.id, "UNAUTHORIZED_ACCESS_BLOCKED", req.path, undefined, `Role ${role} attempted an endpoint restricted to ${options.roles.join(", ")}.`);
    res.status(403).json({ error: "Unauthorized for this role.", allowedRoles: options.roles });
    return null;
  }

  if (options.role && actor.role !== options.role) {
    await audit(actor.id, "UNAUTHORIZED_ACCESS_BLOCKED", req.path, undefined, `Role ${actor.role} attempted an endpoint restricted to ${options.role}.`);
    res.status(403).json({ error: "Unauthorized for this role.", allowedRoles: [options.role] });
    return null;
  }

  if (options.userId && actor.id !== options.userId) {
    await audit(actor.id, "UNAUTHORIZED_ACCESS_BLOCKED", req.path, undefined, `User ${actor.id} attempted to act for user ${options.userId}.`);
    res.status(403).json({ error: "Cannot act on another user's data." });
    return null;
  }

  return actor;
}

export function requireRole(roles: Role[]) {
  return async (req: Request, res: Response, next: () => void) => {
    const actor = await authorizeRequest(req, res, { roles });
    if (!actor) return;
    next();
  };
}
