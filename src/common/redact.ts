/** Strip secrets before anything is logged or stored in diagnostics. */
export function redact(value: unknown): string {
  const text =
    value instanceof Error ? `${value.name}: ${value.message}` : typeof value === "string" ? value : safeJson(value);
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/rc_session=[^;\s]+/gi, "rc_session=[redacted]")
    .replace(/(bearer\s+)[a-z0-9._~+/-]+=*/gi, "$1[redacted]")
    .replace(/(password|token|secret|authorization|cookie)(["']?\s*[:=]\s*["']?)[^"',\s}]+/gi, "$1$2[redacted]")
    .replace(/\b[a-f0-9]{32,}\b/gi, "[token]")
    .slice(0, 2000);
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
