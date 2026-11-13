import { Injectable } from "@nestjs/common";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { Request, Response } from "express";
import { DATA } from "../paths";
import { readJson, writeJson } from "../common/json-file";
import { clip, cleanEmail, cleanName, cleanPassword } from "../common/validate";
import { clientIp } from "../common/url";
import type { AuthToken, PlanId, PublicUser, Session, User, UserPreferences } from "./auth.types";

const COOKIE = "rc_session";
const SESSION_DAYS = 30;

type Failure = { n: number; reset: number };

@Injectable()
export class AuthService {
  private readonly usersFile = join(DATA, "users.json");
  private readonly sessionsFile = join(DATA, "sessions.json");
  private readonly tokensFile = join(DATA, "tokens.json");
  private users: Record<string, User> = {};
  private sessions: Record<string, Session> = {};
  private tokens: AuthToken[] = [];
  private dummyHash = "";
  private failures = new Map<string, Failure>();

  constructor() {
    mkdirSync(DATA, { recursive: true });
    this.users = readJson(this.usersFile, {});
    this.sessions = readJson(this.sessionsFile, {});
    this.tokens = readJson<{ tokens: AuthToken[] }>(this.tokensFile, { tokens: [] }).tokens || [];
    this.dummyHash = this.hashPassword("not-a-real-password");
  }

  private saveUsers() {
    writeJson(this.usersFile, this.users);
  }

  private saveSessions() {
    writeJson(this.sessionsFile, this.sessions);
  }

  private saveTokens() {
    writeJson(this.tokensFile, { tokens: this.tokens.filter((token) => token.expiresAt > Date.now()) });
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  }

  private checkPassword(password: string, stored: string) {
    const [salt, hash] = String(stored).split(":");
    if (!salt || !hash) return false;
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private tokenKey(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private hashIp(ip: string) {
    const file = join(DATA, ".ip-salt");
    if (!existsSync(file)) writeFileSync(file, randomBytes(16).toString("hex"));
    const salt = readFileSync(file, "utf8").trim();
    return createHash("sha256").update(`${salt}|${ip}`).digest("hex").slice(0, 16);
  }

  private cookie(value: string, maxAge: number) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
  }

  preferencesOf(user: User | null | undefined): UserPreferences {
    const stored = user?.preferences;
    return {
      theme: stored?.theme === "system" ? "system" : "dark",
      language: "en",
      notifications: {
        product: stored?.notifications?.product !== false,
        billing: stored?.notifications?.billing !== false,
        marketing: stored?.notifications?.marketing === true,
        exportReady: stored?.notifications?.exportReady !== false,
      },
      privacy: {
        analytics: stored?.privacy?.analytics !== false,
        crashReports: stored?.privacy?.crashReports !== false,
      },
    };
  }

  publicUser(user: User | null | undefined): PublicUser | null {
    if (!user || user.deletedAt) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      avatarUrl: user.avatarUrl || null,
      emailVerified: Boolean(user.emailVerifiedAt),
      pendingEmail: user.pendingEmail || null,
      plan: user.plan || "free",
      preferences: this.preferencesOf(user),
    };
  }

  getById(id: string) {
    return this.users[id] || null;
  }

  setPlan(userId: string, plan: PlanId) {
    const user = this.users[userId];
    if (!user || user.deletedAt) return;
    user.plan = plan;
    this.saveUsers();
  }

  userCount() {
    return Object.values(this.users).filter((user) => !user.deletedAt).length;
  }

  /** Includes deleted accounts so the one-time project claim cannot run twice. */
  createdCount() {
    return Object.keys(this.users).length;
  }

  private findByEmail(email: string) {
    return Object.values(this.users).find((user) => user.email === email && !user.deletedAt) || null;
  }

  readCookie(req: Request) {
    const header = req.headers.cookie || "";
    for (const part of header.split(";")) {
      const [key, ...value] = part.trim().split("=");
      if (key === COOKIE) return decodeURIComponent(value.join("="));
    }
    return null;
  }

  private capSessions(userId: string) {
    const owned = Object.entries(this.sessions)
      .filter(([, session]) => session.userId === userId)
      .sort((a, b) => (a[1].createdAt || "").localeCompare(b[1].createdAt || ""));
    for (const [key] of owned.slice(0, Math.max(0, owned.length - 10))) delete this.sessions[key];
  }

  startSession(req: Request, res: Response, userId: string) {
    const token = randomBytes(32).toString("hex");
    const now = new Date().toISOString();
    const session: Session = {
      id: randomUUID(),
      userId,
      expiresAt: Date.now() + SESSION_DAYS * 864e5,
      createdAt: now,
      lastSeenAt: now,
      userAgent: clip(req.headers["user-agent"], 180) || "Unknown device",
      ipHash: this.hashIp(clientIp(req)),
    };
    this.sessions[this.tokenKey(token)] = session;
    this.capSessions(userId);
    this.saveSessions();
    res.setHeader("Set-Cookie", this.cookie(token, SESSION_DAYS * 86400));
    return session;
  }

  endSession(req: Request, res: Response) {
    const token = this.readCookie(req);
    if (token) {
      delete this.sessions[this.tokenKey(token)];
      delete this.sessions[token];
      this.saveSessions();
    }
    res.setHeader("Set-Cookie", this.cookie("", 0));
  }

  resolve(req: Request): { user: User; sessionId: string } | null {
    const token = this.readCookie(req);
    if (!token) return null;
    const hashed = this.tokenKey(token);
    let key = hashed;
    let session = this.sessions[hashed];
    if (!session && this.sessions[token]) {
      session = this.sessions[token];
      key = token;
    }
    if (!session) return null;
    const user = this.users[session.userId];
    if (!user || user.deletedAt || session.expiresAt <= Date.now()) {
      delete this.sessions[key];
      this.saveSessions();
      return null;
    }
    if (!session.id) session.id = randomUUID();
    if (key !== hashed) {
      this.sessions[hashed] = session;
      delete this.sessions[token];
      this.saveSessions();
    }
    const seen = Date.parse(session.lastSeenAt || "");
    if (!Number.isFinite(seen) || Date.now() - seen > 5 * 60 * 1000) {
      session.lastSeenAt = new Date().toISOString();
      session.userAgent = clip(req.headers["user-agent"], 180) || session.userAgent;
      this.saveSessions();
    }
    return { user, sessionId: session.id };
  }

  resolveUser(req: Request) {
    return this.resolve(req)?.user || null;
  }

  private locked(email: string) {
    const failure = this.failures.get(email);
    return Boolean(failure && failure.reset > Date.now() && failure.n >= 8);
  }

  private recordFailure(email: string) {
    const now = Date.now();
    const failure = this.failures.get(email);
    if (!failure || failure.reset <= now) this.failures.set(email, { n: 1, reset: now + 15 * 60 * 1000 });
    else failure.n += 1;
  }

  signup(input: { name?: string; email?: string; password?: string }) {
    const email = cleanEmail(input.email);
    const name = cleanName(input.name);
    const password = cleanPassword(input.password);
    if (this.findByEmail(email)) throw new Error("An account with that email already exists");
    const user: User = {
      id: randomUUID(),
      email,
      name,
      passwordHash: this.hashPassword(password),
      createdAt: new Date().toISOString(),
      plan: "free",
      preferences: this.preferencesOf(null),
    };
    this.users[user.id] = user;
    this.saveUsers();
    return user;
  }

  signin(input: { email?: string; password?: string }) {
    const email = String(input.email || "").trim().toLowerCase();
    const password = String(input.password || "");
    if (this.locked(email)) throw new Error("Too many attempts. Try again in a few minutes.");
    const user = this.findByEmail(email);
    const stored = user?.passwordHash || this.dummyHash;
    const ok = password.length > 0 && password.length <= 128 && this.checkPassword(password, stored);
    if (!user || !ok) {
      this.recordFailure(email);
      throw new Error(this.locked(email) ? "Too many attempts. Try again in a few minutes." : "Wrong email or password");
    }
    this.failures.delete(email);
    return user;
  }

  issueToken(userId: string, kind: AuthToken["kind"], email?: string, ttlMs = 2 * 864e5) {
    const raw = randomBytes(32).toString("hex");
    this.tokens = this.tokens.filter((token) => !(token.userId === userId && token.kind === kind) && token.expiresAt > Date.now());
    this.tokens.push({
      hash: this.tokenKey(raw),
      userId,
      kind,
      email,
      expiresAt: Date.now() + ttlMs,
    });
    this.saveTokens();
    return raw;
  }

  private consumeToken(raw: string, kind: AuthToken["kind"]) {
    const hash = this.tokenKey(String(raw || ""));
    const token = this.tokens.find((item) => item.hash === hash && item.kind === kind && item.expiresAt > Date.now()) || null;
    if (!token) return null;
    this.tokens = this.tokens.filter((item) => item !== token);
    this.saveTokens();
    return token;
  }

  resetPassword(raw: string, password: string, req: Request, res: Response) {
    const token = this.consumeToken(raw, "reset");
    const user = token ? this.users[token.userId] : null;
    if (!token || !user || user.deletedAt) throw new Error("That reset link is invalid or expired.");
    user.passwordHash = this.hashPassword(cleanPassword(password));
    this.saveUsers();
    this.revokeAll(user.id);
    this.startSession(req, res, user.id);
    return user;
  }

  lookupForReset(email: string) {
    try {
      return this.findByEmail(cleanEmail(email));
    } catch {
      return null;
    }
  }

  verifyToken(raw: string) {
    const emailChange = this.consumeToken(raw, "email");
    const token = emailChange || this.consumeToken(raw, "verify");
    const user = token ? this.users[token.userId] : null;
    if (!token || !user || user.deletedAt) throw new Error("That link is invalid or expired.");
    if (token.kind === "email" && token.email) {
      const taken = this.findByEmail(token.email);
      if (taken && taken.id !== user.id) throw new Error("That email is already in use");
      user.email = token.email;
      user.pendingEmail = null;
    }
    user.emailVerifiedAt = new Date().toISOString();
    this.saveUsers();
    return user;
  }

  updateProfile(user: User, name: unknown) {
    user.name = cleanName(name);
    this.saveUsers();
    return user;
  }

  changePassword(user: User, current: unknown, next: unknown, sessionId: string) {
    if (!this.checkPassword(String(current || ""), user.passwordHash)) throw new Error("Wrong password");
    user.passwordHash = this.hashPassword(cleanPassword(next));
    this.saveUsers();
    this.revokeAll(user.id, sessionId);
    return user;
  }

  requestEmailChange(user: User, email: unknown, password: unknown) {
    if (!this.checkPassword(String(password || ""), user.passwordHash)) throw new Error("Wrong password");
    const next = cleanEmail(email);
    if (next === user.email) throw new Error("That’s already your email");
    if (this.findByEmail(next)) throw new Error("An account with that email already exists");
    user.pendingEmail = next;
    this.saveUsers();
    return this.issueToken(user.id, "email", next);
  }

  updatePreferences(user: User, patch: Partial<UserPreferences> & { notifications?: Partial<UserPreferences["notifications"]>; privacy?: Partial<UserPreferences["privacy"]> }) {
    const prefs = this.preferencesOf(user);
    if (patch.theme === "dark" || patch.theme === "system") prefs.theme = patch.theme;
    if (patch.language === "en") prefs.language = "en";
    for (const key of ["product", "billing", "marketing", "exportReady"] as const) {
      if (typeof patch.notifications?.[key] === "boolean") prefs.notifications[key] = patch.notifications[key];
    }
    for (const key of ["analytics", "crashReports"] as const) {
      if (typeof patch.privacy?.[key] === "boolean") prefs.privacy[key] = patch.privacy[key];
    }
    user.preferences = prefs;
    this.saveUsers();
    return prefs;
  }

  listSessions(userId: string, currentId: string) {
    return Object.values(this.sessions)
      .filter((session) => session.userId === userId && session.expiresAt > Date.now())
      .map((session) => ({
        id: session.id,
        current: session.id === currentId,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        userAgent: session.userAgent || "Unknown device",
        expiresAt: new Date(session.expiresAt).toISOString(),
      }))
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  }

  revokeSession(userId: string, sessionId: string) {
    for (const [key, session] of Object.entries(this.sessions)) {
      if (session.userId === userId && session.id === sessionId) delete this.sessions[key];
    }
    this.saveSessions();
  }

  revokeAll(userId: string, exceptId?: string) {
    for (const [key, session] of Object.entries(this.sessions)) {
      if (session.userId === userId && session.id !== exceptId) delete this.sessions[key];
    }
    this.saveSessions();
  }

  setAvatar(user: User, url: string) {
    const previous = user.avatarUrl || null;
    user.avatarUrl = url;
    this.saveUsers();
    return previous;
  }

  clearAvatar(user: User) {
    const previous = user.avatarUrl || null;
    user.avatarUrl = null;
    this.saveUsers();
    return previous;
  }

  assertDelete(user: User, password: unknown, confirm: unknown) {
    if (confirm !== "DELETE") throw new Error("Type DELETE to confirm");
    if (!this.checkPassword(String(password || ""), user.passwordHash)) throw new Error("Wrong password");
  }

  finalizeDelete(userId: string) {
    const user = this.users[userId];
    if (!user) return;
    user.email = `deleted+${user.id}@users.reelcreator.invalid`;
    user.name = "Deleted user";
    user.passwordHash = this.hashPassword(randomBytes(24).toString("hex"));
    user.deletedAt = new Date().toISOString();
    user.avatarUrl = null;
    user.pendingEmail = null;
    user.plan = "free";
    this.revokeAll(userId);
    this.saveUsers();
  }
}
