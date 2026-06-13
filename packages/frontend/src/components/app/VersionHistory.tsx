import type { SpecVersion } from '@dsi/shared';

type Props = {
  history: SpecVersion[];
  currentSpec: object | null;   // used to highlight the active version
  onRestore: (id: string) => void;
};

/**
 * VersionHistory — lists saved spec versions, newest first.
 * Each entry shows its name, layout, and timestamp.
 * "Restore" saves a fresh copy so the timeline is always additive.
 */
export function VersionHistory({ history, onRestore }: Props) {
  if (history.length === 0) {
    return (
      <div className="text-xs text-gray-400 text-center py-4">
        No saved versions yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((v, i) => (
        <div
          key={v.id}
          className="flex items-start justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">
              {i === 0 && (
                <span className="mr-1.5 inline-block rounded bg-indigo-100 px-1 py-0.5 text-xs font-semibold text-indigo-700">
                  current
                </span>
              )}
              {v.spec.name ?? 'Untitled view'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {v.spec.layout} · {formatDate(v.savedAt)}
            </p>
          </div>
          {i > 0 && (
            <button
              onClick={() => onRestore(v.id)}
              className="flex-shrink-0 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Restore
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
