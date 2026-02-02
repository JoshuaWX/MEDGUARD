import { supabase } from './supabase';

// ============================================================================
// PERFORMANCE CONFIGURATION
// ============================================================================
const DEFAULT_TIMEOUT_MS = 60000; // 60 seconds for chat requests
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff for retries

export type EdgeInvokeOptions = {
  headers?: Record<string, string>;
  /** Timeout in milliseconds. Default: 60000 (60s) */
  timeout?: number;
  /** AbortController signal for cancellation */
  signal?: AbortSignal;
  /** Number of retries for transient errors. Default: 0 */
  retries?: number;
};

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Check if an error is retryable (network issues, 5xx errors)
 */
function isRetryableError(error: any): boolean {
  const status = error?.context?.status;
  // Retry on network errors, 502, 503, 504 (gateway errors)
  if (!status) return true; // Network error
  return [502, 503, 504].includes(status);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Invoke a Supabase Edge Function with timeout, cancellation, and retry support.
 * 
 * PERFORMANCE FEATURES:
 * - Configurable timeout to prevent hanging requests
 * - AbortController support for request cancellation (e.g., when user leaves screen)
 * - Automatic retry with exponential backoff for transient errors
 * - Non-blocking: returns immediately on cancellation
 */
export async function invokeEdgeFunction<T>(
  name: string,
  body?: unknown,
  options?: EdgeInvokeOptions
): Promise<{ data: T | null; error: Error | null }> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options?.retries ?? 0;
  
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check if already aborted before starting
    if (options?.signal?.aborted) {
      return { data: null, error: new Error('Request cancelled') };
    }

    try {
      const token = await getAccessToken();

      const headers: Record<string, string> = {
        ...(options?.headers || {}),
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        const id = setTimeout(() => {
          reject(new Error(`Request timed out after ${timeout}ms`));
        }, timeout);
        
        // Clear timeout if request is aborted
        options?.signal?.addEventListener('abort', () => {
          clearTimeout(id);
          reject(new Error('Request cancelled'));
        });
      });

      // Race between the actual request and timeout
      const { data, error } = await Promise.race([
        supabase.functions.invoke<T>(name, {
          body,
          headers,
        }),
        timeoutPromise,
      ]);

      if (error) {
        const anyErr: any = error as any;
        const status = typeof anyErr?.context?.status === 'number' ? anyErr.context.status : null;

        // Check if we should retry
        if (attempt < maxRetries && isRetryableError(anyErr)) {
          lastError = error;
          await sleep(RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1]);
          continue;
        }

        let details: string | null = null;
        try {
          if (anyErr?.context && typeof anyErr.context.text === 'function') {
            details = await anyErr.context.text();
          }
        } catch {
          // ignore
        }

        const msgParts = [error.message];
        if (status) msgParts.push(`status=${status}`);
        if (details && details.trim()) msgParts.push(details.trim());

        return { data: null, error: new Error(msgParts.join(' | ')) };
      }

      return { data: (data as any) ?? null, error: null };
    } catch (e: any) {
      // Handle timeout and abort errors
      if (e.message?.includes('cancelled') || e.message?.includes('aborted')) {
        return { data: null, error: new Error('Request cancelled') };
      }
      if (e.message?.includes('timed out')) {
        return { data: null, error: new Error('Request timed out. Please try again.') };
      }

      // Retry on network errors
      if (attempt < maxRetries && !e.message?.includes('cancelled')) {
        lastError = e as Error;
        await sleep(RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1]);
        continue;
      }

      return { data: null, error: e as Error };
    }
  }

  // If we exhausted retries
  return { 
    data: null, 
    error: lastError || new Error('Request failed after retries') 
  };
}
