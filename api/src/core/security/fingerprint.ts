import { createHash } from "node:crypto";
import { isIP } from "node:net";

export interface RequestFingerprint {
  /** Same browser/app on the same network ≈ same device (catches incognito / cleared cookies). */
  deviceHash: string;
  /** Network neighbourhood: /24 for IPv4, /64 for IPv6 (catches proxy/VPN farms). */
  subnetHash: string;
}

/** "::ffff:203.0.113.7" → "203.0.113.7" */
function normalizeIp(ip: string): string {
  return ip.startsWith("::ffff:") && isIP(ip.slice(7)) === 4 ? ip.slice(7) : ip;
}

function expandIpv6(ip: string): string[] {
  const [head = "", tail = ""] = ip.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missing = 8 - headParts.length - tailParts.length;
  return [...headParts, ...Array<string>(Math.max(missing, 0)).fill("0"), ...tailParts].map((p) =>
    p.padStart(4, "0").toLowerCase(),
  );
}

export function subnetOf(rawIp: string): string {
  const ip = normalizeIp(rawIp);
  if (isIP(ip) === 4) return `${ip.split(".").slice(0, 3).join(".")}.0/24`;
  if (isIP(ip) === 6) return `${expandIpv6(ip).slice(0, 4).join(":")}::/64`;
  return "unknown";
}

/**
 * Salted SHA-256 fingerprints. The salt makes hashes useless outside this
 * system, and raw IPs never reach the database (privacy by design).
 */
export class Fingerprinter {
  constructor(private readonly salt: string) {}

  private hash(value: string): string {
    return createHash("sha256").update(`${this.salt}|${value}`).digest("base64url");
  }

  compute(input: { ip: string; userAgent: string; acceptLanguage: string }): RequestFingerprint {
    const ip = normalizeIp(input.ip);
    return {
      deviceHash: this.hash(`d|${ip}|${input.userAgent}|${input.acceptLanguage}`),
      subnetHash: this.hash(`s|${subnetOf(ip)}`),
    };
  }
}
