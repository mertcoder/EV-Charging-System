import type { Express } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db";
import { audit, formatZodError } from "../services/core";
import { passwordIssues } from "../../src/shared/password";

const SCRYPT_KEYLEN = 64;

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, SCRYPT_KEYLEN);
  const target = Buffer.from(hash, "hex");
  if (target.length !== candidate.length) return false;
  return timingSafeEqual(target, candidate);
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().superRefine((value, ctx) => {
    for (const issue of passwordIssues(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Password: ${issue.toLowerCase()}.` });
    }
  }),
  role: z.enum(["EV_DRIVER", "STATION_OPERATOR", "ADMINISTRATOR"])
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required.")
});

function publicUser(user: { id: string; name: string; email: string; role: string; isActive: boolean }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive };
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ errors: formatZodError(parsed.error) });
        return;
      }
      const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
      if (existing) {
        res.status(400).json({ errors: ["An account with this email already exists."] });
        return;
      }
      const created = await prisma.user.create({
        data: {
          name: parsed.data.name.replace(/\s+/g, " ").trim(),
          email: parsed.data.email,
          role: parsed.data.role,
          passwordHash: hashPassword(parsed.data.password)
        }
      });
      if (parsed.data.role === "EV_DRIVER") {
        await prisma.wallet.create({ data: { userId: created.id, balanceCents: 0 } });
      }
      await audit(created.id, "USER_REGISTERED", "User", created.id, `${created.email} self-registered as ${created.role}.`);
      res.status(201).json({ user: publicUser(created) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ errors: formatZodError(parsed.error) });
        return;
      }
      const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
      if (!user || !user.isActive || !verifyPassword(parsed.data.password, user.passwordHash)) {
        await audit(user?.id, "LOGIN_FAILED", "User", user?.id, `Failed login for ${parsed.data.email}.`);
        res.status(401).json({ errors: ["Email or password is incorrect."] });
        return;
      }
      await audit(user.id, "LOGIN_SUCCEEDED", "User", user.id, `${user.email} signed in.`);
      res.json({ user: publicUser(user) });
    } catch (error) {
      next(error);
    }
  });
}
