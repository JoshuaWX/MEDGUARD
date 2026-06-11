import { tryCreateAdminClient } from './supabase.ts';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: string;
  currentCount: number;
}

interface EnforceRateLimitOptions {
  bucket: string;
  windowSeconds: number;
  maxRequests: number;
  userId?: string | null;
  subjectId?: string | null;
}

function nowEpochSeconds() {
  return Math.floor(Date.now() / 1000);
}

function parseClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || 'unknown';
}

export async function enforceRateLimit(
  req: Request,
  options: EnforceRateLimitOptions
): Promise<RateLimitResult | null> {
  const admin = tryCreateAdminClient();
  if (!admin) {
    // Gracefully skip enforcement if service role isn't configured.
    return null;
  }

  const id = options.subjectId || (options.userId ? `user:${options.userId}` : `ip:${parseClientIp(req)}`);
  const key = `${options.bucket}:${id}`;

  const { data, error } = await admin.rpc('check_rate_limit', {
    p_key: key,
    p_window_seconds: options.windowSeconds,
    p_max_requests: options.maxRequests,
  });

  if (error || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const row = data[0] as {
    allowed?: boolean;
    remaining?: number;
    reset_at?: string;
    current_count?: number;
  };

  const resetEpoch = row.reset_at ? Math.floor(new Date(row.reset_at).getTime() / 1000) : nowEpochSeconds();

  return {
    allowed: Boolean(row.allowed),
    remaining: Math.max(0, Number(row.remaining ?? 0)),
    retryAfterSeconds: Math.max(1, resetEpoch - nowEpochSeconds()),
    resetAt: row.reset_at || new Date(resetEpoch * 1000).toISOString(),
    currentCount: Math.max(0, Number(row.current_count ?? 0)),
  };
}
