import { useState, useEffect, useRef } from 'react';
import type { Item } from '@dsi/shared';
import { fetchItems } from '../api/client';

type LiveDataState = {
  items: Item[];
  connected: boolean;
  loading: boolean;
  error: string | null;
};

type LiveEvent =
  | { type: 'connected';     appId: string }
  | { type: 'items:changed'; appId: string; items: Item[] };

const WS_RECONNECT_DELAY_MS = 3000;

/**
 * useLiveData — engine hook, domain-agnostic.
 *
 * On mount (and whenever appId changes):
 * 1. Fetches the current item list via REST for an immediate render.
 * 2. Opens a WebSocket to /live?app=<appId> and replaces state on
 *    every 'items:changed' event — no diffing needed, just replace.
 * 3. Reconnects automatically after a disconnect.
 *
 * Changing appId closes the previous WS and starts fresh.
 */
export function useLiveData(appId: string): LiveDataState {
  const [state, setState] = useState<LiveDataState>({
    items: [],
    connected: false,
    loading: true,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeAppId = useRef<string>(appId);

  useEffect(() => {
    activeAppId.current = appId;

    // Reset on domain change
    setState({ items: [], connected: false, loading: true, error: null });

    // Cancel any pending reconnect from a previous domain
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();

    let cancelled = false;

    // 1. Initial REST fetch for immediate data
    fetchItems(appId)
      .then((items) => {
        if (!cancelled) setState((s) => ({ ...s, items, loading: false }));
      })
      .catch((err: Error) => {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: err.message }));
      });

    // 2. WebSocket for live updates
    function connect() {
      if (cancelled) return;

      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = window.location.host;
      const ws = new WebSocket(`${protocol}://${host}/live?app=${encodeURIComponent(appId)}`);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        if (!cancelled) setState((s) => ({ ...s, connected: true }));
      });

      ws.addEventListener('message', (evt) => {
        if (cancelled) return;
        try {
          const event = JSON.parse(evt.data as string) as LiveEvent;
          if (event.type === 'items:changed' && event.appId === activeAppId.current) {
            setState((s) => ({ ...s, items: event.items, loading: false }));
          }
        } catch {
          // malformed event — ignore
        }
      });

      ws.addEventListener('close', () => {
        if (!cancelled) {
          setState((s) => ({ ...s, connected: false }));
          reconnectTimer.current = setTimeout(connect, WS_RECONNECT_DELAY_MS);
        }
      });

      ws.addEventListener('error', () => ws.close());
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [appId]);

  return state;
}
