/** Allow only same-app relative paths (no protocol-relative or external URLs). */
export function safeReturnPath(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;
    return decoded;
  } catch {
    return fallback;
  }
}

export function withReturnTo(path: string, returnTo: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}returnTo=${encodeURIComponent(returnTo)}`;
}
