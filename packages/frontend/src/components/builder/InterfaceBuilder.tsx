import { useState } from 'react';
import type { BaseViewSpec } from '@dsi/shared';
import { useSpecGenerator } from '../../hooks/useSpecGenerator';

type Props = {
  appId: string;
  onGenerated: (spec: BaseViewSpec) => void;
};

/**
 * InterfaceBuilder — the describe-to-interface entry point.
 * User types a plain-English description; on submit it calls
 * POST /api/generate-spec and passes the result to the parent
 * (App.tsx routes it to SpecStore.setPending() for preview).
 */
export function InterfaceBuilder({ appId, onGenerated }: Props) {
  const [description, setDescription] = useState('');
  const { loading, error, generate } = useSpecGenerator();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    const spec = await generate(appId, description);
    if (spec) {
      onGenerated(spec);
      setDescription('');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl/Cmd+Enter submits
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e);
          }}
          placeholder={`Describe the view you want for ${appId} data… (e.g. "show me high-priority items assigned to me")`}
          rows={2}
          disabled={loading}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          type="submit"
          disabled={loading || !description.trim()}
          className="flex-shrink-0 self-end px-4 py-2 rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors"
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      <p className="text-xs text-gray-400">
        Tip: Ctrl+Enter to submit · The AI generates a view spec — you preview it before it applies.
      </p>
    </form>
  );
}
