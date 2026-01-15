import { supabase } from './supabase';

export type EdgeInvokeOptions = {
  headers?: Record<string, string>;
};

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

export async function invokeEdgeFunction<T>(
  name: string,
  body?: unknown,
  options?: EdgeInvokeOptions
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const token = await getAccessToken();

    const headers: Record<string, string> = {
      ...(options?.headers || {}),
    };

    // Ensure the function can read auth
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const { data, error } = await supabase.functions.invoke<T>(name, {
      body,
      headers,
    });

    if (error) {
      const anyErr: any = error as any;
      const status = typeof anyErr?.context?.status === 'number' ? anyErr.context.status : null;

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
  } catch (e) {
    return { data: null, error: e as Error };
  }
}
