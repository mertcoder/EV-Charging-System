import type { Request } from "express";
import { z } from "zod";

export function routeParam(req: Request, name: string) {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => issue.message);
}
