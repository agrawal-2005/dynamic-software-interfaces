import type { BaseViewSpec, SpecVersion } from '@dsi/shared';
import type { ISpecRepository } from './spec-repository';

type Listener = () => void;
type Unsubscribe = () => void;

/**
 * SpecStore — engine class, domain-agnostic, React-independent.
 *
 * State machine with three slots:
 *   current  — the committed, persisted spec (drawn by ViewRenderer)
 *   pending  — an unconfirmed preview spec (waiting for accept/reject)
 *   history  — all past versions from the repository
 *
 * Listeners are notified whenever any slot changes so React hooks can
 * trigger re-renders via useSyncExternalStore or a simple useState bridge.
 */
export class SpecStore {
  private current:  BaseViewSpec | null = null;
  private pending:  BaseViewSpec | null = null;
  private history:  SpecVersion[] = [];
  private listeners = new Set<Listener>();

  constructor(private readonly repo: ISpecRepository) {}

  /** Load persisted state from the repository. Call once after construction. */
  async init(): Promise<void> {
    this.current = await this.repo.getCurrent();
    this.history = await this.repo.listVersions();
    this.notify();
  }

  // ── Reads ─────────────────────────────────────────────────────────────

  getCurrent():  BaseViewSpec | null { return this.current; }
  getPending():  BaseViewSpec | null { return this.pending; }
  getHistory():  SpecVersion[]       { return this.history; }

  // ── Writes ────────────────────────────────────────────────────────────

  /** Stage a newly generated spec for preview — does NOT persist yet. */
  setPending(spec: BaseViewSpec): void {
    this.pending = spec;
    this.notify();
  }

  /** Persist the pending spec, make it current, clear the preview. */
  async acceptPending(): Promise<void> {
    if (!this.pending) return;
    const version = await this.repo.saveVersion(this.pending);
    this.current = this.pending;
    this.pending = null;
    this.history = [version, ...this.history];
    this.notify();
  }

  /** Discard the pending preview — current spec is unchanged. */
  rejectPending(): void {
    this.pending = null;
    this.notify();
  }

  /** Load an old version as current (also saves it as a new version entry). */
  async restoreVersion(versionId: string): Promise<void> {
    const spec = await this.repo.getVersion(versionId);
    if (!spec) return;
    // Restoring re-saves so the timeline shows "restored from vX"
    const version = await this.repo.saveVersion(spec);
    await this.repo.setCurrent(version.id);
    this.current = spec;
    this.history = await this.repo.listVersions();
    this.notify();
  }

  // ── Subscription ─────────────────────────────────────────────────────

  subscribe(listener: Listener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── Private ───────────────────────────────────────────────────────────

  private notify(): void {
    for (const l of this.listeners) l();
  }
}
