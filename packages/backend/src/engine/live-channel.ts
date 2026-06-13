import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import type { DataStore } from './data-store';

/**
 * The payload broadcast to subscribed clients when a DataStore emits 'change'.
 * Carries the full current item list so clients can replace their local state
 * without diffing — simple and correct for a prototype.
 */
export type LiveEvent =
  | { type: 'items:changed'; appId: string; items: unknown[] }
  | { type: 'connected';     appId: string };

/**
 * LiveChannel — engine class, domain-agnostic.
 *
 * Manages one WebSocket server attached to the Express HTTP server.
 * Clients connect with ?app=<id>; the channel routes broadcasts only to
 * clients subscribed to the matching domain. Domain isolation is structural:
 * a message for 'finance' is never delivered to an 'engineering' socket.
 */
export class LiveChannel {
  private wss: WebSocketServer | null = null;
  /** Maps appId → set of open WebSocket connections for that domain. */
  private rooms: Map<string, Set<WebSocket>> = new Map();

  /**
   * Subscribe to a domain's DataStore 'change' events.
   * Called once per domain at startup by the registry loop.
   */
  attachStore(appId: string, store: DataStore): void {
    this.rooms.set(appId, new Set());
    store.on('change', ({ items }: { items: unknown[] }) => {
      this.broadcast(appId, { type: 'items:changed', appId, items });
    });
  }

  /**
   * Attach the WebSocket server to the Express HTTP server.
   * Parses the ?app= query param on connect and routes the socket
   * to the correct room. Sockets with an unrecognised appId are closed.
   */
  attach(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/live' });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const appId = this.parseAppId(req.url ?? '');
      const room = appId ? this.rooms.get(appId) : undefined;

      if (!room) {
        ws.close(4000, `Unknown app: "${appId}"`);
        return;
      }

      room.add(ws);
      this.send(ws, { type: 'connected', appId });

      ws.on('close', () => room.delete(ws));
      ws.on('error', () => room.delete(ws));
    });
  }

  broadcast(appId: string, event: LiveEvent): void {
    const room = this.rooms.get(appId);
    if (!room) return;
    const payload = JSON.stringify(event);
    for (const ws of room) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  connectionCount(appId: string): number {
    return this.rooms.get(appId)?.size ?? 0;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private send(ws: WebSocket, event: LiveEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  private parseAppId(url: string): string {
    try {
      const params = new URL(url, 'http://localhost').searchParams;
      return params.get('app') ?? '';
    } catch {
      return '';
    }
  }
}
