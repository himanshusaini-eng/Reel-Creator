/** Accounts + cookie sessions, stored as JSON under data/ (no external deps). */
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const COOKIE = "rc_session";
const SESSION_DAYS = 30;

export function createAuth(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const usersFile = join(dataDir, "users.json");
  const sessionsFile = join(dataDir, "sessions.json");

  const load = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {});
  const users = load(usersFile); // id → user
  const sessions = load(sessionsFile); // token → { userId, expiresAt }
  const saveUsers = () => writeFileSync(usersFile, JSON.stringify(users, null, 2));
  const saveSessions = () => writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));

  function hashPassword(password) {
    const salt = randomBytes(16).toString("hex");
    return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  }

  function checkPassword(password, stored) {
    const [salt, hash] = String(stored).split(":");
    if (!salt || !hash) return false;
    const a = scryptSync(password, salt, 64);
    const b = Buffer.from(hash, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  const publicUser = (u) => u && { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt };
  const findByEmail = (email) => Object.values(users).find((u) => u.email === email) || null;

  function readCookie(req) {
    const header = req.headers.cookie || "";
    for (const part of header.split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k === COOKIE) return decodeURIComponent(v.join("="));
    }
    return null;
  }

  function startSession(res, userId) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + SESSION_DAYS * 864e5;
    sessions[token] = { userId, expiresAt };
    saveSessions();
    res.setHeader(
      "Set-Cookie",
      `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}` +
        (process.env.NODE_ENV === "production" ? "; Secure" : "")
    );
  }

  function endSession(req, res) {
    const token = readCookie(req);
    if (token && sessions[token]) {
      delete sessions[token];
      saveSessions();
    }
    res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  }

  /** Sets req.user when the session cookie is valid. */
  function attachUser(req, _res, next) {
    const token = readCookie(req);
    const s = token && sessions[token];
    if (s && s.expiresAt > Date.now() && users[s.userId]) {
      req.user = users[s.userId];
    } else if (s) {
      delete sessions[token];
      saveSessions();
    }
    next();
  }

  function requireUser(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "Sign in required" });
    next();
  }

  /** For HTML pages: bounce to /signin and come back afterwards. */
  function requirePage(req, res, next) {
    if (!req.user) return res.redirect(`/signin?next=${encodeURIComponent(req.originalUrl)}`);
    next();
  }

  function signup({ name, email, password }) {
    email = String(email || "").trim().toLowerCase();
    name = String(name || "").trim();
    password = String(password || "");
    if (!name) throw new Error("Name is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email");
    if (password.length < 8) throw new Error("Password must be at least 8 characters");
    if (findByEmail(email)) throw new Error("An account with that email already exists");
    const user = {
      id: randomUUID(),
      email,
      name,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    users[user.id] = user;
    saveUsers();
    return user;
  }

  function signin({ email, password }) {
    const user = findByEmail(String(email || "").trim().toLowerCase());
    if (!user || !checkPassword(String(password || ""), user.passwordHash)) {
      throw new Error("Wrong email or password");
    }
    return user;
  }

  const userCount = () => Object.keys(users).length;

  return { attachUser, requireUser, requirePage, startSession, endSession, signup, signin, publicUser, userCount };
}
