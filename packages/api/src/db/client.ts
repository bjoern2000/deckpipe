import pg from 'pg';
import { config } from '../config.js';

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  // Fail a stuck connection attempt fast (instead of hanging indefinitely) so
  // the retry loop below can wait out a cold-starting DB on its own schedule.
  connectionTimeoutMillis: 5000,
});

// A pooled client can emit 'error' asynchronously when the backend goes away —
// e.g. Railway's serverless Postgres spinning down between requests kills idle
// connections. Without a listener, pg re-emits this as an unhandled error on the
// process, which can crash it. Swallow it: the pool discards the dead client and
// query() re-establishes a fresh connection on the next call.
pool.on('error', (err) => {
  console.error('[db] idle client error (pool will recover):', err.message);
});

/**
 * Postgres/socket conditions that mean the query never reached the server —
 * the DB is cold-starting or the private network to it isn't up yet. Because
 * nothing executed, retrying is safe even for INSERT/UPDATE/DELETE.
 *
 * Deliberately excludes mid-flight failures (ECONNRESET, "connection
 * terminated", 08006) where a write might have already committed.
 */
const RETRYABLE_CODES = new Set([
  'ECONNREFUSED', // container up but not yet accepting connections
  'ETIMEDOUT', // TCP connect timed out
  'ENOTFOUND', // private-network DNS not resolvable yet
  'EAI_AGAIN', // transient DNS failure
  '57P03', // cannot_connect_now — "the database system is starting up"
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
]);

function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string; errors?: unknown[] };
  if (e.code && RETRYABLE_CODES.has(e.code)) return true;
  // pg-pool raises an AggregateError when every address (IPv4 + IPv6) is
  // refused; the real codes live in the nested `errors` array.
  if (Array.isArray(e.errors) && e.errors.some(isRetryable)) return true;
  const msg = e.message ?? '';
  return msg.includes('starting up') || msg.includes('timeout exceeded when trying to connect');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Backoff schedule spanning ~15s — long enough to cover a serverless Postgres
// cold start, short enough to stay well under any client/proxy request timeout.
const RETRY_DELAYS_MS = [250, 500, 1000, 2000, 3000, 4000, 4000];

export async function query(text: string, params?: unknown[]) {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      lastErr = err;
      if (attempt === RETRY_DELAYS_MS.length || !isRetryable(err)) throw err;
      const wait = RETRY_DELAYS_MS[attempt];
      console.warn(
        `[db] transient connection error (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1}), ` +
          `retrying in ${wait}ms: ${(err as { message?: string }).message ?? err}`,
      );
      await sleep(wait);
    }
  }
  throw lastErr;
}

export function getPool() {
  return pool;
}
