/**
 * GlobalChatPanel — ONE chat for the whole app.
 *
 * Context is derived automatically:
 *   appId   → from AppContext (tracks active domain)
 *   section → from URL (dashboard/explorer/analytics) or sectionOverride ('sidebar')
 *
 * Spec routing:
 *   sidebar section  → POST /api/generate-sidebar-spec  (SidebarSpec)
 *   all others       → POST /api/generate-spec          (BaseViewSpec)
 *
 * Spec isolation:
 *   Each (appId, section) pair is an independent slot in GlobalAiContext.
 *   Navigating from engineering:dashboard to product:explorer means the
 *   NEXT message edits product:explorer — engineering:dashboard is untouched.
 *   A context-change banner is inserted automatically when either changes.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, Send, Loader2, Bot, User, RotateCcw } from 'lucide-react';
import type { BaseViewSpec, SidebarSpec } from '@dsi/shared';
import { useApp } from '../../context/AppContext';
import { useGlobalAi } from '../../context/GlobalAiContext';
import { useCurrentSection } from '../../hooks/useCurrentSection';
import { generateSpec, generateSidebarSpec } from '../../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

type MessageRole = 'user' | 'assistant' | 'error' | 'context';

type Message = {
  id:      string;
  role:    MessageRole;
  content: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  explorer:  'Explorer',
  analytics: 'Analytics',
  settings:  'Settings',
  sidebar:   'Sidebar',
};

const SECTION_PLACEHOLDERS: Record<string, string> = {
  dashboard: 'e.g. "hide done" · "show only critical"',
  explorer:  'e.g. "show title and status only"',
  analytics: 'e.g. "focus on priority breakdown"',
  sidebar:   'e.g. "hide finance" · "rename product"',
  settings:  'Settings can\'t be customised via AI',
};

const SECTION_GREETINGS: Record<string, string> = {
  dashboard: 'I can customise this Kanban board — try "hide done", "show only critical bugs", or "group by assignee".',
  explorer:  'I can customise this table — try "show title and priority only", "filter high priority", or "sort by date".',
  analytics: 'I can focus the analytics — try "break down by assignee", "only in-progress items", or "group by priority".',
  sidebar:   'I can customise your sidebar — try "hide finance", "rename product to Growth", or "show only engineering".',
  settings:  'Settings is read-only — switch to another tab to customise the view.',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function GlobalChatPanel() {
  const { appId, apps }                   = useApp();
  const { isChatOpen, sectionOverride, closeChat, getSpec, setSpec } = useGlobalAi();
  const urlSection                        = useCurrentSection();
  const activeSection                     = sectionOverride ?? urlSection;
  const isReadOnly                        = activeSection === 'settings';

  // Context string used to detect mid-conversation context switches
  const contextKey = activeSection === 'sidebar' ? `global:${activeSection}` : `${appId}:${activeSection}`;

  const [messages, setMessages] = useState<Message[]>([
    { id: 'init', role: 'assistant', content: SECTION_GREETINGS[activeSection] ?? "Hi! Describe what you'd like to change." },
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef<HTMLDivElement>(null);
  const lastContextRef        = useRef<string>(contextKey);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Insert a context-change separator when domain or section changes mid-session
  useEffect(() => {
    if (lastContextRef.current === contextKey) return;
    lastContextRef.current = contextKey;
    const appLabel  = apps.find((a) => a.id === appId)?.label ?? appId;
    const secLabel  = SECTION_LABELS[activeSection] ?? activeSection;
    setMessages((prev) => [
      ...prev,
      {
        id:      `ctx-${Date.now()}`,
        role:    'context',
        content: `Switched to ${appLabel} › ${secLabel}`,
      },
    ]);
  }, [contextKey, appId, activeSection, apps]);

  // ── Send ────────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || isReadOnly) return;
    setInput('');

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: text },
    ]);
    setLoading(true);

    try {
      // Semantic intent detection: if the message is about sidebar-level operations
      // (hiding/showing/renaming workspaces or domains), route to the sidebar generator
      // regardless of which section is currently active.
      const allAppNames = apps.flatMap((a) => [a.id.toLowerCase(), a.label.toLowerCase()]);
      const resolvedSection = (activeSection === 'sidebar' || isSidebarIntent(text, allAppNames))
        ? 'sidebar'
        : activeSection;

      const specAppId   = resolvedSection === 'sidebar' ? 'global' : appId;
      const currentSpec = getSpec(specAppId, resolvedSection);

      let newSpec: BaseViewSpec | SidebarSpec;

      if (resolvedSection === 'sidebar') {
        newSpec = await generateSidebarSpec(text, currentSpec as SidebarSpec | null);
      } else {
        const hint = SECTION_LABELS[resolvedSection] ?? resolvedSection;
        newSpec = await generateSpec(appId, `${text} (for ${hint} view)`, currentSpec as BaseViewSpec | null);
      }

      setSpec(specAppId, resolvedSection, newSpec);

      setMessages((prev) => [
        ...prev,
        {
          id:      `a-${Date.now()}`,
          role:    'assistant',
          content: describeChange(currentSpec, newSpec, resolvedSection),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id:      `e-${Date.now()}`,
          role:    'error',
          content: err instanceof Error ? err.message : 'Something went wrong — try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, isReadOnly, activeSection, appId, apps, getSpec, setSpec]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  }

  function handleReset() {
    const specAppId = activeSection === 'sidebar' ? 'global' : appId;
    setSpec(specAppId, activeSection, null);
    setMessages((prev) => [
      ...prev,
      { id: `r-${Date.now()}`, role: 'assistant', content: 'Reset — showing default view.' },
    ]);
  }

  if (!isChatOpen) return null;

  const appLabel = apps.find((a) => a.id === appId)?.label ?? appId;
  const secLabel = SECTION_LABELS[activeSection] ?? activeSection;
  const hasSpec  = activeSection === 'sidebar'
    ? getSpec('global', 'sidebar') !== null
    : getSpec(appId, activeSection) !== null;

  return (
    <div className="flex flex-col w-[300px] flex-shrink-0 border-l border-gray-200 bg-white h-full">

      {/* Header — shows current context */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
            <Sparkles size={11} className="text-white" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-semibold text-gray-800">AI Assistant</span>
            {/* Context badge: "Engineering › Dashboard" */}
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-gray-400 truncate">{appLabel}</span>
              <span className="text-[10px] text-gray-300">›</span>
              <span className="text-[10px] font-medium text-indigo-500">{secLabel}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasSpec && (
            <button
              onClick={handleReset}
              className="p-1 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50"
              title="Reset to default"
            >
              <RotateCcw size={13} />
            </button>
          )}
          <button
            onClick={closeChat}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg) => {
          // Context-change separator
          if (msg.role === 'context') {
            return (
              <div key={msg.id} className="flex items-center gap-2 py-1">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[10px] text-gray-400 whitespace-nowrap">{msg.content}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
            );
          }

          return (
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
                  : <Bot  size={11} className="text-gray-500"   />
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
          );
        })}

        {loading && (
          <div className="flex gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
              <Loader2 size={11} className="text-gray-500 animate-spin" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms'   }} />
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
            placeholder={SECTION_PLACEHOLDERS[activeSection] ?? 'Describe what to change…'}
            disabled={loading || isReadOnly}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50 min-w-0"
          />
          <button
            onClick={() => void handleSend()}
            disabled={loading || !input.trim() || isReadOnly}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
          >
            <Send size={13} />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 px-1">
          Enter to send · editing <span className="text-indigo-400 font-medium">{appLabel} › {secLabel}</span>
        </p>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if the message text is clearly about sidebar-level operations
 * (hiding/showing/renaming workspaces or domains) rather than view-level changes.
 *
 * Checks two things:
 *   1. Explicit sidebar keywords ("sidebar", "workspace", "domain", "nav")
 *   2. A hide/show/rename verb paired with a known app name
 *
 * This lets the chat correctly route "hide engineering and finance domains"
 * to generateSidebarSpec() even when the user is on the dashboard section.
 */
function isSidebarIntent(text: string, appNames: string[]): boolean {
  const lower = text.toLowerCase();
  if (/\b(sidebar|workspace|domain|domains|nav|navigation)\b/.test(lower)) return true;
  const hasVerb    = /\b(hide|show|remove|add|rename|reorder|move)\b/.test(lower);
  const hasAppName = appNames.some((n) => lower.includes(n));
  return hasVerb && hasAppName;
}

function describeChange(prev: unknown, next: BaseViewSpec | SidebarSpec, section: string): string {
  if (section === 'sidebar') {
    const s = next as SidebarSpec;
    const visible = s.items.filter((i) => i.visible !== false).length;
    const hidden  = s.items.length - visible;
    const renamed = s.items.filter((i) => i.label).map((i) => i.label!);
    const parts: string[] = [];
    if (hidden  > 0)     parts.push(`${hidden} item${hidden > 1 ? 's' : ''} hidden`);
    if (renamed.length)  parts.push(`renamed: ${renamed.join(', ')}`);
    return parts.length ? parts.join(' · ') + '.' : 'Sidebar updated.';
  }

  const p = prev as BaseViewSpec | null;
  const n = next as BaseViewSpec;

  if (!p) {
    const vis = n.fields.filter((f) => f.visible !== false).length;
    return `Applied "${n.name ?? n.layout} view" — ${vis} fields, ${n.layout} layout${n.filters?.length ? `, ${n.filters.length} filter(s)` : ''}.`;
  }

  const changes: string[] = [];
  if (p.layout !== n.layout) changes.push(`Layout → ${n.layout}`);
  if (p.groupBy !== n.groupBy) changes.push(n.groupBy ? `Grouped by ${n.groupBy}` : 'Removed grouping');

  const pVis = new Set(p.fields.filter((f) => f.visible !== false).map((f) => f.key));
  const nVis = new Set(n.fields.filter((f) => f.visible !== false).map((f) => f.key));
  const added   = [...nVis].filter((k) => !pVis.has(k));
  const removed = [...pVis].filter((k) => !nVis.has(k));
  if (added.length)   changes.push(`Added: ${added.join(', ')}`);
  if (removed.length) changes.push(`Removed: ${removed.join(', ')}`);

  const pf = JSON.stringify(p.filters ?? []);
  const nf = JSON.stringify(n.filters ?? []);
  if (pf !== nf) {
    const d = (n.filters?.length ?? 0) - (p.filters?.length ?? 0);
    changes.push(d > 0 ? `+${d} filter(s)` : d < 0 ? `${d} filter(s)` : 'Filters updated');
  }
  if (JSON.stringify(p.sort) !== JSON.stringify(n.sort)) {
    changes.push(n.sort ? `Sort: ${n.sort.field} ${n.sort.direction}` : 'Sort removed');
  }

  return changes.length ? changes.join(' · ') + '.' : 'No visible changes.';
}
