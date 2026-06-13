import type { SpecVersion } from '@dsi/shared';
import { Clock, RotateCcw, CheckCircle2 } from 'lucide-react';

type Props = {
  history: SpecVersion[];
  currentVersionId: string | null;
  onRestore: (id: string) => void;
};

export function VersionHistory({ history, currentVersionId, onRestore }: Props) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Clock size={20} className="text-gray-300" />
        <p className="text-xs text-gray-400">No saved versions yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((v) => {
        const isCurrent = v.id === currentVersionId;
        return (
          <div
            key={v.id}
            className={[
              'flex items-start justify-between gap-2 rounded-xl border px-3 py-2.5 transition-colors',
              isCurrent
                ? 'border-indigo-200 bg-indigo-50'
                : 'border-gray-100 bg-gray-50 hover:border-gray-200',
            ].join(' ')}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {isCurrent && (
                  <CheckCircle2 size={12} className="text-indigo-500 flex-shrink-0" />
                )}
                <p className={[
                  'text-sm font-medium truncate',
                  isCurrent ? 'text-indigo-800' : 'text-gray-800',
                ].join(' ')}>
                  {v.spec.name ?? 'Untitled view'}
                </p>
                {isCurrent && (
                  <span className="flex-shrink-0 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">
                    active
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {v.spec.layout} · {formatDate(v.savedAt)}
              </p>
            </div>
            {!isCurrent && (
              <button
                onClick={() => onRestore(v.id)}
                className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                title="Restore this version"
              >
                <RotateCcw size={11} />
                Restore
              </button>
            )}
          </div>
        );
      })}
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
