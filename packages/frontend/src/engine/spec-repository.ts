import type { BaseViewSpec, SpecVersion } from '@dsi/shared';

// ── Interface ─────────────────────────────────────────────────────────────

/**
 * ISpecRepository — the storage contract.
 * Never overwrites: each save creates a new version entry.
 * The DB adapter replaces LocalStorageSpecRepository by implementing this.
 */
export interface ISpecRepository {
  saveVersion(spec: BaseViewSpec): Promise<SpecVersion>;
  getCurrent(): Promise<BaseViewSpec | null>;
  setCurrent(versionId: string): Promise<void>;
  listVersions(): Promise<SpecVersion[]>;
  getVersion(id: string): Promise<BaseViewSpec | null>;
  clear(): Promise<void>;
}

// ── localStorage adapter ──────────────────────────────────────────────────

type StorageShape = {
  versions: SpecVersion[];
  currentId: string | null;
};

/**
 * LocalStorageSpecRepository — ISpecRepository over localStorage.
 * Namespaced by appId so switching domains never cross-contaminates history.
 * Namespace key format: `dsi:spec:<appId>`
 */
export class LocalStorageSpecRepository implements ISpecRepository {
  private readonly key: string;

  constructor(appId: string) {
    this.key = `dsi:spec:${appId}`;
  }

  async saveVersion(spec: BaseViewSpec): Promise<SpecVersion> {
    const shape = this.read();
    const version: SpecVersion = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      spec,
    };
    shape.versions.unshift(version); // newest first
    shape.currentId = version.id;
    this.write(shape);
    return version;
  }

  async getCurrent(): Promise<BaseViewSpec | null> {
    const shape = this.read();
    if (!shape.currentId) return null;
    const version = shape.versions.find((v) => v.id === shape.currentId);
    return version?.spec ?? null;
  }

  async setCurrent(versionId: string): Promise<void> {
    const shape = this.read();
    if (!shape.versions.find((v) => v.id === versionId)) return;
    shape.currentId = versionId;
    this.write(shape);
  }

  async listVersions(): Promise<SpecVersion[]> {
    return this.read().versions;
  }

  async getVersion(id: string): Promise<BaseViewSpec | null> {
    return this.read().versions.find((v) => v.id === id)?.spec ?? null;
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.key);
  }

  // ── Private ───────────────────────────────────────────────────────────

  private read(): StorageShape {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) return JSON.parse(raw) as StorageShape;
    } catch {
      // corrupted — start fresh
    }
    return { versions: [], currentId: null };
  }

  private write(shape: StorageShape): void {
    localStorage.setItem(this.key, JSON.stringify(shape));
  }
}
