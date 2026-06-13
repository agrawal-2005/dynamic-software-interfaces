import { useState, useRef } from 'react';
import type { BaseViewSpec } from '@dsi/shared';
import { Sparkles, ArrowUp, Loader2 } from 'lucide-react';
import { useSpecGenerator } from '../../hooks/useSpecGenerator';

type Props = {
  appId: string;
  onGenerated: (spec: BaseViewSpec) => void;
};

export function InterfaceBuilder({ appId, onGenerated }: Props) {
  const [description, setDescription] = useState('');
  const { loading, error, generate } = useSpecGenerator();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!description.trim() || loading) return;
    const spec = await generate(appId, description);
    if (spec) {
      onGenerated(spec);
      setDescription('');
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <div className="space-y-3">
      {/* Input card */}
      <div className={[
        'relative rounded-xl border bg-white transition-shadow',
        loading
          ? 'border-indigo-200 shadow-sm shadow-indigo-100'
          : 'border-gray-200 hover:border-gray-300 focus-within:border-indigo-300 focus-within:shadow-sm focus-within:shadow-indigo-100',
      ].join(' ')}>

        {/* AI indicator */}
        <div className="flex items-center gap-1.5 px-3 pt-3 pb-1">
          <Sparkles size={12} className="text-indigo-400" />
          <span className="text-xs font-medium text-indigo-500">AI view builder</span>
        </div>

        <textarea
          ref={textareaRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Describe the view you want — e.g. "Show high-priority open tickets grouped by assignee"`}
          rows={3}
          disabled={loading}
          className="w-full resize-none bg-transparent px-3 pb-2 pt-1 text-sm text-gray-800 placeholder-gray-400 focus:outline-none disabled:text-gray-400"
        />

        {/* Submit button row */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1 border-t border-gray-100">
          <span className="text-xs text-gray-400">⌘↵ to generate</span>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={loading || !description.trim()}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              loading || !description.trim()
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
            ].join(' ')}
          >
            {loading
              ? <><Loader2 size={12} className="animate-spin" /> Generating…</>
              : <><ArrowUp size={12} /> Generate</>
            }
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <span className="text-xs text-red-600">{error}</span>
        </div>
      )}
    </div>
  );
}
