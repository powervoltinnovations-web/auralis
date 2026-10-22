export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MEDIA_TYPES: Record<string, string[]> = {
  mp3: ["audio/mpeg"],
  m4a: ["audio/mp4", "audio/x-m4a"],
  aac: ["audio/aac"],
  wav: ["audio/wav", "audio/x-wav"],
  mp4: ["video/mp4"],
};
export function validateFile(file: {
  name: string;
  size: number;
  type: string;
}): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!MEDIA_TYPES[ext] || !MEDIA_TYPES[ext].includes(file.type))
    return "Choose an MP3, M4A, AAC, WAV, or MP4 file with a matching media type.";
  if (file.size <= 0) return "This file is empty.";
  if (file.size > MAX_FILE_BYTES) return "Files must be 50 MB or smaller.";
  return null;
}
export async function validateSignature(
  file: Blob,
  extension: string,
): Promise<boolean> {
  const b = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const s = (start: number, end: number) =>
    String.fromCharCode(...b.slice(start, end));
  if (extension === "mp3")
    return s(0, 3) === "ID3" || (b[0] === 255 && (b[1] & 224) === 224);
  if (extension === "aac") return b[0] === 255 && (b[1] & 246) === 240;
  if (extension === "wav") return s(0, 4) === "RIFF" && s(8, 12) === "WAVE";
  if (extension === "m4a" || extension === "mp4") return s(4, 8) === "ftyp";
  return false;
}
export function securityHeaders(
  nonce: string,
  projectUrl?: string,
  dev = false,
): Record<string, string> {
  let origin = "";
  try {
    const u = new URL(projectUrl ?? "");
    if (u.protocol === "https:") origin = u.origin;
  } catch {}
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${origin}${dev ? " ws: http://localhost:* http://127.0.0.1:*" : ""}`,
    `media-src 'self' blob: ${origin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
  return {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Cache-Control": "private, no-store",
  };
}
