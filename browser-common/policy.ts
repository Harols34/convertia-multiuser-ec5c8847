export type UrlPolicyCheckReason =
  | "ok"
  | "domain"
  | "invalid"
  | "protocol"
  | "http"
  | "blocked";

export type UrlPolicyCheckResult = {
  ok: boolean;
  why: UrlPolicyCheckReason;
  host?: string;
};

export type BrowserPolicyInput = {
  allowedDomains?: string[];
  allowedUrlPrefixes?: string[];
  blockedUrlPatterns?: string[];
  allowHttp?: boolean;
};

export type NormalizedBrowserPolicy = {
  allowedDomains: string[];
  allowedUrlPrefixes: string[];
  blockedUrlPatterns: string[];
  allowHttp: boolean;
};

const DANGEROUS_PROTOCOLS = new Set([
  "javascript:",
  "data:",
  "file:",
  "blob:",
  "vbscript:",
]);

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function sanitizeList(values: string[] | undefined) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => value.trim())
    .filter(Boolean);
}

function hasProtocol(value: string) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

function ensureUrlValue(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  return hasProtocol(raw) ? raw : `https://${raw}`;
}

function normalizePort(url: URL) {
  if (url.port) return url.port;
  return url.protocol === "https:" ? "443" : "80";
}

function normalizeHost(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function normalizeDomainEntry(value: string) {
  const raw = value.trim();
  if (!raw) return null;

  const wildcardPrefix = raw.startsWith("*.") ? "*." : "";
  const withoutWildcard = wildcardPrefix ? raw.slice(2) : raw;
  const candidate = ensureUrlValue(withoutWildcard);
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname) return null;
    return `${wildcardPrefix}${normalizeHost(parsed.hostname)}`;
  } catch {
    return null;
  }
}

function normalizePrefixEntry(value: string) {
  const candidate = ensureUrlValue(value);
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeBlockedPattern(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function wildcardToRegExp(pattern: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const wildcard = escaped.replace(/\*/g, ".*");
  return new RegExp(`^${wildcard}$`, "i");
}

function looksLikeRegexPattern(value: string) {
  return value.startsWith("/") && value.endsWith("/") && value.length > 2;
}

function matchBlockedPattern(url: URL, pattern: string) {
  const fullUrl = url.toString().toLowerCase();
  const host = url.hostname.toLowerCase();

  if (looksLikeRegexPattern(pattern)) {
    try {
      const regex = new RegExp(pattern.slice(1, -1), "i");
      return regex.test(fullUrl);
    } catch {
      return false;
    }
  }

  if (pattern.includes("*")) {
    const wildcardRegex = wildcardToRegExp(pattern);
    return wildcardRegex.test(fullUrl) || wildcardRegex.test(host);
  }

  if (pattern.includes("://") || pattern.includes("/") || pattern.includes("?")) {
    return fullUrl.includes(pattern);
  }

  return host === pattern || host.endsWith(`.${pattern}`) || fullUrl.includes(pattern);
}

function pathMatchesPrefix(targetPath: string, prefixPath: string) {
  if (prefixPath === "/" || prefixPath === "") return true;
  if (targetPath === prefixPath) return true;
  if (!targetPath.startsWith(prefixPath)) return false;
  if (prefixPath.endsWith("/")) return true;
  return targetPath.charAt(prefixPath.length) === "/";
}

function queryMatchesPrefix(target: URL, prefix: URL) {
  if (![...prefix.searchParams.keys()].length) return true;

  for (const [key, value] of prefix.searchParams.entries()) {
    const targetValues = target.searchParams.getAll(key);
    if (targetValues.length === 0) return false;
    if (value && !targetValues.includes(value)) return false;
  }

  return true;
}

function matchUrlPrefix(targetUrl: URL, prefix: string) {
  let parsedPrefix: URL;
  try {
    parsedPrefix = new URL(prefix);
  } catch {
    return false;
  }

  if (parsedPrefix.protocol !== targetUrl.protocol) return false;
  if (normalizeHost(parsedPrefix.hostname) !== normalizeHost(targetUrl.hostname)) return false;
  if (normalizePort(parsedPrefix) !== normalizePort(targetUrl)) return false;

  const targetPath = targetUrl.pathname || "/";
  const prefixPath = parsedPrefix.pathname || "/";

  if (!pathMatchesPrefix(targetPath, prefixPath)) return false;
  if (!queryMatchesPrefix(targetUrl, parsedPrefix)) return false;

  return true;
}

function matchDomain(targetHost: string, candidate: string) {
  const normalizedHost = normalizeHost(targetHost);
  const normalizedCandidate = normalizeHost(candidate);

  if (!normalizedCandidate) return false;

  if (normalizedCandidate.startsWith("*.")) {
    const base = normalizedCandidate.slice(2);
    return normalizedHost === base || normalizedHost.endsWith(`.${base}`);
  }

  return (
    normalizedHost === normalizedCandidate ||
    normalizedHost.endsWith(`.${normalizedCandidate}`)
  );
}

export function normalizeBrowserPolicy(input: BrowserPolicyInput): NormalizedBrowserPolicy {
  const allowedDomains = unique(
    sanitizeList(input.allowedDomains).map(normalizeDomainEntry).filter(Boolean) as string[]
  );
  const allowedUrlPrefixes = unique(
    sanitizeList(input.allowedUrlPrefixes)
      .map(normalizePrefixEntry)
      .filter(Boolean) as string[]
  );
  const blockedUrlPatterns = unique(
    sanitizeList(input.blockedUrlPatterns)
      .map(normalizeBlockedPattern)
      .filter(Boolean) as string[]
  );

  return {
    allowedDomains,
    allowedUrlPrefixes,
    blockedUrlPatterns,
    allowHttp: Boolean(input.allowHttp),
  };
}

export function isUrlAllowedByPolicy(
  url: string,
  policyInput: BrowserPolicyInput
): UrlPolicyCheckResult {
  const policy = normalizeBrowserPolicy(policyInput);

  try {
    const parsed = new URL(url);
    const host = normalizeHost(parsed.hostname);

    if (DANGEROUS_PROTOCOLS.has(parsed.protocol)) {
      return { ok: false, why: "protocol", host };
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { ok: false, why: "protocol", host };
    }

    if (parsed.protocol === "http:" && !policy.allowHttp) {
      return { ok: false, why: "http", host };
    }

    if (
      policy.blockedUrlPatterns.some((pattern) => matchBlockedPattern(parsed, pattern))
    ) {
      return { ok: false, why: "blocked", host };
    }

    if (policy.allowedUrlPrefixes.some((prefix) => matchUrlPrefix(parsed, prefix))) {
      return { ok: true, why: "ok", host };
    }

    if (policy.allowedDomains.some((domain) => matchDomain(host, domain))) {
      return { ok: true, why: "ok", host };
    }

    return { ok: false, why: "domain", host };
  } catch {
    return { ok: false, why: "invalid" };
  }
}
