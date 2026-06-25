import bcrypt from "bcryptjs";
import { parse as parseCookie } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { User } from "../../drizzle/schema";
import { getUserById } from "../db";
import { ENV } from "./env";
import { getSessionCookieOptions } from "./cookies";

const encoder = new TextEncoder();
const TOKEN_TTL_SECONDS = Math.floor(ONE_YEAR_MS / 1000);

type SessionClaims = {
  sub: string;
};

function getJwtSecret() {
  if (ENV.jwtSecret) {
    return encoder.encode(ENV.jwtSecret);
  }

  if (ENV.isProduction) {
    throw new Error("JWT_SECRET is required in production");
  }

  console.warn("[Auth] JWT_SECRET is not set. Using an insecure development secret.");
  return encoder.encode("dev-only-change-me");
}

function getTokenFromRequest(req: Request) {
  const cookies = parseCookie(req.headers.cookie ?? "");
  const cookieToken = cookies[COOKIE_NAME];
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken;
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createSessionToken(user: Pick<User, "id" | "email" | "role">) {
  return new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function setSessionCookie(req: Request, res: Response, user: User) {
  const token = await createSessionToken(user);
  res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: ONE_YEAR_MS,
  });
  return token;
}

export function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
}

export async function authenticateRequest(req: Request): Promise<User | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;

  const verified = await jwtVerify<SessionClaims>(token, getJwtSecret());
  const userId = Number(verified.payload.sub);
  if (!Number.isInteger(userId)) return null;

  return (await getUserById(userId)) ?? null;
}
