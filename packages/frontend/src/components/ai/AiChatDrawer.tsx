import { useState, useRef, useEffect } from 'react';
import type { BaseViewSpec } from '@dsi/shared';
import { Sparkles, X, Send, Loader2, Bot, User, RotateCcw } from 'lucide-react';
import { generateSpec } from '../../api/client';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
};

type Props = {
  appId: string;
  tabHint: string;
  placeholder?: string;
  onSpec: (spec: BaseViewSpec) => void;
  onClose: () => void;
  /** Optional local command handler — return a feedback string if handled, null to fall through to AI. */
  onLocalCommand?: (text: string) => string | null;
};

export function AiChatDrawer({ appId, tabHint, placeholder, onSpec, onClose, onLocalCommand }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'assistant',
      content: getGreeting(tabHint),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);

    // Try local command handler first (instant, no API call)
    if (onLocalCommand) {
      const localResult = onLocalCommand(text);
      if (localResult !== null) {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', content: localResult },
        ]);
        return;
      }
    }

    setLoading(true);

    try {
      const description = tabHint ? `${text} (for ${tabHint} view)` : text;
      const spec = await generateSpec(appId, description);
      const name = spec.name ?? `${spec.layout} view`;
      const visibleFields = spec.fields.filter((f) => f.visible !== false).length;
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: `Applied "${name}" — ${visibleFields} fields, ${spec.layout} layout${spec.filters?.length ? `, ${spec.filters.length} filter(s)` : ''}`,
        },
      ]);
      onSpec(spec);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'error',
          content: err instanceof Error ? err.message : 'Something went wrong — try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  }

  return (
    <div className="flex flex-col w-[300px] flex-shrink-0 border-l border-gray-200 bg-white h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Sparkles size={11} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-800">AI Assistant</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={[
              'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5',
              msg.role === 'user' ? 'bg-indigo-100' : 'bg-gray-100',
            ].join(' ')}>
              {msg.role === 'user'
                ? <User size={11} className="text-indigo-600" />
                : <Bot size={11} className="text-gray-500" />
              }
            </div>
            <div className={[
              'rounded-2xl px-3 py-2 text-[13px] leading-relaxed max-w-[210px]',
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-sm'
                : msg.role === 'error'
                ? 'bg-red-50 text-red-700 border border-red-100 rounded-tl-sm'
                : 'bg-gray-100 text-gray-800 rounded-tl-sm',
            ].join(' ')}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
              <Loader2 size={11} className="text-gray-500 animate-spin" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-100 p-3">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? 'Describe what to change…'}
            disabled={loading}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50 min-w-0"
          />
          <button
            onClick={() => void handleSend()}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
          >
            <Send size={13} />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 px-1">Enter to send · AI customizes the current tab</p>
      </div>
    </div>
  );
}

// Reset button helper — exported for parent to add a "Clear AI" button
export function AiResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 border border-gray-200 rounded-lg px-2.5 py-1.5 transition-colors"
      title="Clear AI customization"
    >
      <RotateCcw size={11} /> Reset
    </button>
  );
}

function getGreeting(hint: string): string {
  if (hint.includes('board') || hint.includes('kanban')) {
    return 'Hi! I can customise this board — e.g. "show only critical bugs" · "group by assignee" · "hide done column"';
  }
  if (hint.includes('table') || hint.includes('explorer')) {
    return 'Hi! I can customise this table — e.g. "show title and priority only" · "filter high priority items" · "sort by date"';
  }
  if (hint.includes('analytics')) {
    return 'Hi! I can focus the analytics — e.g. "break down by assignee" · "show only in-progress items" · "group by priority"';
  }
  return "Hi! Describe what you'd like to see and I'll customise this view for you.";
}
