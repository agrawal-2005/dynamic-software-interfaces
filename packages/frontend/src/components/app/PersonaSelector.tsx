import type { BaseViewSpec } from '@dsi/shared';
import { getPresets } from '../../app/domains/preset-registry';

type Props = {
  appId: string;
  onSelect: (spec: BaseViewSpec) => void;
  vertical?: boolean;
};

/**
 * PersonaSelector — shows domain-appropriate persona preset buttons.
 * Selecting a preset loads that spec directly as the current view
 * (bypasses the AI, skips the preview step — instant gratification for demos).
 * Pass `vertical` to stack presets in a column (e.g. in a sidebar).
 */
export function PersonaSelector({ appId, onSelect, vertical }: Props) {
  const presets = getPresets(appId);
  if (presets.length === 0) return null;

  if (vertical) {
    return (
      <div className="flex flex-col gap-1.5">
        {presets.map((p) => (
          <button
            key={p.persona}
            onClick={() => onSelect(p.spec)}
            className="text-left px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        Start with:
      </span>
      {presets.map((p) => (
        <button
          key={p.persona}
          onClick={() => onSelect(p.spec)}
          className="px-3 py-1 text-xs font-medium rounded-full border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
