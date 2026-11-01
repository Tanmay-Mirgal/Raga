import { isOnline, OfflineError } from '../../utils/network';

/**
 * Resilient JSON client for community-hosted music APIs, which go down often.
 *
 *  - several interchangeable hosts; a host that fails is benched for a minute
 *    so the next calls skip straight to a healthy one
 *  - per-request timeout, one quick retry on network/5xx/429
 *  - fails fast when the device is offline so callers can fall back to cache
 */

const BENCH_MS = 60_000;
const benchedUntil = new Map<string, number>();

export class HttpError extends Error {
  constructor(public status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface RequestOptions<T> {
  timeoutMs?: number;
  /** Return false to treat a 200 response as a failure (e.g. `success: false`). */
  validate?: (json: T) => boolean;
}

export async function requestJson<T>(
  hosts: string[],
  path: string,
  { timeoutMs = 8000, validate }: RequestOptions<T> = {}
): Promise<T> {
  if (!isOnline()) throw new OfflineError();

  const now = Date.now();
  const healthy = hosts.filter((h) => (benchedUntil.get(h) ?? 0) <= now);
  const benched = hosts.filter((h) => (benchedUntil.get(h) ?? 0) > now);
  const ordered = [...healthy, ...benched]; // benched hosts are still tried last

  let lastError: unknown = new Error('No API hosts configured');

  for (const host of ordered) {
    const url = `${host}${path}`;
    let hostFailed = false;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetchWithTimeout(url, timeoutMs);
        if (res.status === 404) throw new HttpError(404, url);
        if (res.status === 429 || res.status >= 500) throw new HttpError(res.status, url);
        if (!res.ok) throw new HttpError(res.status, url);

        const json = (await res.json()) as T;
        if (validate && !validate(json)) throw new Error(`Invalid payload from ${url}`);

        benchedUntil.delete(host);
        return json;
      } catch (e) {
        lastError = e;
        if (e instanceof HttpError && e.status === 404) throw e; // genuinely missing, not a host problem
        hostFailed = true;
        if (attempt === 0) await sleep(250);
      }
    }

    if (hostFailed) benchedUntil.set(host, Date.now() + BENCH_MS);
  }

  throw lastError;
}
