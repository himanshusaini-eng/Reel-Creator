/** User-facing validation. Thrown messages are safe to show in the UI. */

export function cleanName(value: unknown) {
  const name = String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
  if (!name) throw new Error("Name is required");
  if (name.length > 80) throw new Error("Name is too long");
  return name;
}

export function cleanEmail(value: unknown) {
  const email = String(value ?? "")
    .trim()
    .toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email");
  }
  return email;
}

export function cleanPassword(value: unknown) {
  const password = String(value ?? "");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  if (password.length > 128) throw new Error("Password is too long");
  return password;
}

export function clip(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}
