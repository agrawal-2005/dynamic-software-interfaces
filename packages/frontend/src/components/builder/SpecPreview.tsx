import type { BaseViewSpec } from '@dsi/shared';

type Props = {
  spec: BaseViewSpec;
  onAccept: () => void;
  onReject: () => void;
};

/**
 * SpecPreview — shown when there is a pending (unconfirmed) ViewSpec.
 * Displays the spec's name, layout, and field/filter summary so the user
 * can decide to accept or reject before it becomes the current view.
 */
export function SpecPreview({ spec, onAccept, onReject }: Props) {
  const visibleFields = spec.fields.filter((f) => f.visible).map((f) => f.label ?? f.key);

  return (
    <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-indigo-900">{spec.name ?? 'Generated view'}</p>
          {spec.description && (
            <p className="text-xs text-indigo-600 mt-0.5">{spec.description}</p>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onReject}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            Discard
          </button>
          <button
            onClick={onAccept}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Apply view
          </button>
        </div>
      </div>

      {/* Spec summary chips */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        <Chip label="Layout" value={spec.layout} color="indigo" />
        {spec.groupBy && <Chip label="Group by" value={spec.groupBy} color="purple" />}
        {spec.sort && (
          <Chip label="Sort" value={`${spec.sort.field} ${spec.sort.direction}`} color="blue" />
        )}
        {spec.filters.length > 0 && (
          <Chip label="Filters" value={`${spec.filters.length}`} color="amber" />
        )}
        <Chip label="Fields" value={visibleFields.slice(0, 4).join(', ') + (visibleFields.length > 4 ? '…' : '')} color="gray" />
      </div>
    </div>
  );
}

type ChipColor = 'indigo' | 'purple' | 'blue' | 'amber' | 'gray';

const colorMap: Record<ChipColor, string> = {
  indigo: 'bg-indigo-100 text-indigo-700',
  purple: 'bg-purple-100 text-purple-700',
  blue:   'bg-blue-100 text-blue-700',
  amber:  'bg-amber-100 text-amber-700',
  gray:   'bg-gray-100 text-gray-600',
};

function Chip({ label, value, color }: { label: string; value: string; color: ChipColor }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${colorMap[color]}`}>
      <span className="font-medium">{label}:</span> {value}
    </span>
  );
}
