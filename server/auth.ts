import type { Request, Response, NextFunction, RequestHandler } from "express";
import { supabase } from "./supabase";

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export const requireAuth: RequestHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized - No token provided" });
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Unauthorized - Invalid token" });
    }

    req.userId = user.id;
    req.userEmail = user.email;
    next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({ error: "Unauthorized - Authentication failed" });
  }
};

export function getUserId(req: AuthRequest): string {
  if (!req.userId) {
    throw new Error("User not authenticated");
  }
  return req.userId;
}
