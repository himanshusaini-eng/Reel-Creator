import { Injectable } from "@nestjs/common";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { Request, Response } from "express";
import { DATA } from "../paths";
import type { PublicUser, Session, User } from "./auth.types";

const COOKIE = "rc_session";
const SESSION_DAYS = 30;

@Injectable()
export class AuthService {
  private readonly usersFile = join(DATA, "users.json");
  private readonly sessionsFile = join(DATA, "sessions.json");
  private users: Record<string, User> = {};
  private sessions: Record<string, Session> = {};

  constructor() {
    mkdirSync(DATA, { recursive: true });
    this.users = this.load(this.usersFile);
    this.sessions = this.load(this.sessionsFile);
  }

  private load<T>(file: string): T {
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : ({} as T);
  }

  private saveUsers() {
    writeFileSync(this.usersFile, JSON.stringify(this.users, null, 2));
  }

  private saveSessions() {
    writeFileSync(this.sessionsFile, JSON.stringify(this.sessions, null, 2));
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  }

  private checkPassword(password: string, stored: string) {
    const [salt, hash] = String(stored).split(":");
    if (!salt || !hash) return false;
    const a = scryptSync(password, salt, 64);
    const b = Buffer.from(hash, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  publicUser(u: User | null | undefined): PublicUser | null {
    return u ? { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt } : null;
  }

  private findByEmail(email: string) {
    return Object.values(this.users).find((u) => u.email === email) || null;
  }

  readCookie(req: Request) {
    const header = req.headers.cookie || "";
    for (const part of header.split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k === COOKIE) return decodeURIComponent(v.join("="));
    }
    return null;
  }

  startSession(res: Response, userId: string) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + SESSION_DAYS * 864e5;
    this.sessions[token] = { userId, expiresAt };
    this.saveSessions();
    res.setHeader(
      "Set-Cookie",
      `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}` +
        (process.env.NODE_ENV === "production" ? "; Secure" : ""),
    );
  }

  endSession(req: Request, res: Response) {
    const token = this.readCookie(req);
    if (token && this.sessions[token]) {
      delete this.sessions[token];
      this.saveSessions();
    }
    res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  }

  resolveUser(req: Request): User | null {
    const token = this.readCookie(req);
    const s = token ? this.sessions[token] : null;
    if (s && s.expiresAt > Date.now() && this.users[s.userId]) {
      return this.users[s.userId];
    }
    if (s && token) {
      delete this.sessions[token];
      this.saveSessions();
    }
    return null;
  }

  signup({ name, email, password }: { name?: string; email?: string; password?: string }) {
    email = String(email || "")
      .trim()
      .toLowerCase();
    name = String(name || "").trim();
    password = String(password || "");
    if (!name) throw new Error("Name is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email");
    if (password.length < 8) throw new Error("Password must be at least 8 characters");
    if (this.findByEmail(email)) throw new Error("An account with that email already exists");
    const user: User = {
      id: randomUUID(),
      email,
      name,
      passwordHash: this.hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    this.users[user.id] = user;
    this.saveUsers();
    return user;
  }

  signin({ email, password }: { email?: string; password?: string }) {
    const user = this.findByEmail(String(email || "").trim().toLowerCase());
    if (!user || !this.checkPassword(String(password || ""), user.passwordHash)) {
      throw new Error("Wrong email or password");
    }
    return user;
  }

  userCount() {
    return Object.keys(this.users).length;
  }
}
