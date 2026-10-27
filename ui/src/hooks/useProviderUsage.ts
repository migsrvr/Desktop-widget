import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { UsageProvider, UsageSnapshot } from '@workpulse/shared';
import { emptyUsage, mergeUsageSnapshot } from '../utils/usageState';

/** Account readings come only from the native usage service, never the IDE WebSocket. */
export function useProviderUsage() {
  const [providers, setProviders] = useState<UsageSnapshot>(emptyUsage);
  const [pending, setPending] = useState<UsageProvider | 'refresh' | null>(null);
  const [errors, setErrors] = useState<Partial<Record<UsageProvider | 'refresh', string>>>({});
  const mounted = useRef(true);
  const supported = isTauri();
  const merge = useCallback((snapshot: UsageSnapshot) => { if (mounted.current) setProviders(previous => mergeUsageSnapshot(previous, snapshot)); }, []);
  useEffect(() => {
    mounted.current = true;
    if (!supported) return () => { mounted.current = false; };
    let disposed = false;
    const subscription = listen<UsageSnapshot>('session:usage-updated', event => { if (!disposed) merge(event.payload); });
    void subscription.then(async unlisten => {
      if (disposed) { unlisten(); return; }
      try { const snapshot = await invoke<UsageSnapshot>('get_usage_snapshot'); if (!disposed) merge(snapshot); }
      catch { if (!disposed) setErrors({ refresh: 'The native usage service is unavailable. Restart SESSION to try again.' }); }
    }).catch(() => { if (!disposed) setErrors({ refresh: 'Could not subscribe to provider usage updates.' }); });
    const resume = () => { if (!disposed) void invoke<UsageSnapshot>('refresh_usage').then(merge).catch(() => {}); };
    window.addEventListener('focus', resume);
    const visibility = () => { if (document.visibilityState === 'visible') resume(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { disposed = true; mounted.current = false; void subscription.then(unlisten => unlisten()).catch(() => {}); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', visibility); };
  }, [supported, merge]);

  const act = useCallback(async (command: string, provider?: UsageProvider) => {
    if (!supported || pending) return;
    const key = provider ?? 'refresh';
    setPending(key); setErrors(previous => ({ ...previous, [key]: undefined }));
    try { merge(await invoke<UsageSnapshot>(command, provider ? { provider } : {})); }
    catch (error) { if (mounted.current) setErrors(previous => ({ ...previous, [key]: typeof error === 'string' ? error : 'Provider connection failed. Try again.' })); }
    finally { if (mounted.current) setPending(null); }
  }, [supported, pending, merge]);

  return { providers, supported, pending, errors,
    connect: useCallback((provider: UsageProvider) => act('connect_usage_provider', provider), [act]),
    disconnect: useCallback((provider: UsageProvider) => act('disconnect_usage_provider', provider), [act]),
    refresh: useCallback(() => act('refresh_usage'), [act]),
  };
}
