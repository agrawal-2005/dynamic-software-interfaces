/**
 * GlobalChatPanel — ONE chat for the whole app.
 *
 * Design contract:
 *   The frontend sends the user's raw message + ALL surface contexts to the backend.
 *   The backend AI decides which surface the message targets (by meaning, not keywords)
 *   and returns either a validated spec + target surface, or a structured clarification
 *   request when two surfaces are plausible.
 *
 *   The frontend makes ZERO routing decisions — it only sends context and applies results.
 *
 * Surface routing (backend-owned):
 *   POST /api/generate receives: message, appId, activeSurface (hint), currentSpecs for all surfaces.
 *   Response { status: "applied", targetSurface, spec, message }
 *           | { status: "needs_clarification", question, options }
 *
 * On needs_clarification:
 *   The chat renders the question and clickable option buttons.
 *   The user's pick is sent back with forceSurface set — backend skips conflict detection.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Loader2, Bot, User, RotateCcw } from 'lucide-react';
import type { BaseViewSpec, SidebarSpec, NavSpec, ClarificationOption } from '@dsi/shared';
import { LogoMark } from '../LogoMark';
import { useApp } from '../../context/AppContext';
import { useGlobalAi, useGlobalSpec } from '../../context/GlobalAiContext';
import { useCurrentSection } from '../../hooks/useCurrentSection';
import { generate } from '../../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

type MessageRole = 'user' | 'assistant' | 'error' | 'context' | 'clarification';

type Message = {
  id:   string;
  role: MessageRole;
  content: string;
  /** Present only on clarification messages. */
  clarification?: {
    question:        string;
    options:         ClarificationOption[];
    originalMessage: string; // re-sent with forceSurface on option pick
  };
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
  dashboard: 'e.g. "hide done" · "group by assignee"',
  explorer:  'e.g. "show title and status only"',
  analytics: 'e.g. "focus on priority breakdown"',
  sidebar:   'e.g. "hide finance" · "rename product"',
  settings:  'Settings can\'t be customised via AI',
};

const SECTION_GREETINGS: Record<string, string> = {
  dashboard: 'I can customise this view — try "hide done", "show only critical bugs", or "group by assignee".',
  explorer:  'I can customise this table — try "show title and priority only", "filter high priority", or "sort by date".',
  analytics: 'I can focus the analytics — try "break down by assignee" or "only in-progress items".',
  sidebar:   'I can customise your sidebar — try "hide finance", "rename product to Growth", or "show only engineering".',
  settings:  'Settings is read-only — switch to another tab to customise the view.',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function GlobalChatPanel() {
  const { appId, apps }                                       = useApp();
  const { isChatOpen, sectionOverride, closeChat, getSpec, setSpec } = useGlobalAi();
  const urlSection                                            = useCurrentSection();
  const activeSection                                         = sectionOverride ?? urlSection;
  const isReadOnly                                            = activeSection === 'settings';

  // Access sidebar + nav spec for sending as context
  const [sidebarSpec] = useGlobalSpec<SidebarSpec>('global', 'sidebar');
  const [navSpec]     = useGlobalSpec<NavSpec>(appId, 'nav');

  const contextKey = activeSection === 'sidebar'
    ? `global:${activeSection}`
    : `${appId}:${activeSection}`;

  const [messages, setMessages] = useState<Message[]>([
    { id: 'init', role: 'assistant', content: SECTION_GREETINGS[activeSection] ?? "Hi! Describe what you'd like to change." },
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef<HTMLDivElement>(null);
  const lastContextRef        = useRef<string>(contextKey);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Insert a context-change separator when domain or section changes mid-session
  useEffect(() => {
    if (lastContextRef.current === contextKey) return;
    lastContextRef.current = contextKey;
    const appLabel = apps.find((a) => a.id === appId)?.label ?? appId;
    const secLabel = SECTION_LABELS[activeSection] ?? activeSection;
    setMessages((prev) => [
      ...prev,
      { id: `ctx-${Date.now()}`, role: 'context', content: `Switched to ${appLabel} › ${secLabel}` },
    ]);
  }, [contextKey, appId, activeSection, apps]);

  // ── Core send ──────────────────────────────────────────────────────────────
  //
  // All routing intelligence lives in the backend.
  // We send: raw message + appId + activeSurface (hint) + current specs for all surfaces.
  // We receive: { status, targetSurface, spec, message } | { status, question, options }

  const sendToBackend = useCallback(async (
    message: string,
    forceSurface?: string,
  ) => {
    setLoading(true);
    try {
      // Collect current specs for all surfaces
      const currentSpecs: Record<string, unknown> = {
        sidebar: sidebarSpec ?? null,
        nav:     navSpec ?? null,
        [activeSection]: getSpec(appId, activeSection) ?? null,
      };

      const response = await generate({
        message,
        appId,
        activeSurface: activeSection,
        currentSpecs,
        ...(forceSurface ? { forceSurface } : {}),
      });

      if (response.status === 'needs_clarification') {
        setMessages((prev) => [
          ...prev,
          {
            id:      `clr-${Date.now()}`,
            role:    'clarification',
            content: response.question,
            clarification: {
              question:        response.question,
              options:         response.options,
              originalMessage: message,
            },
          },
        ]);
        return;
      }

      // Apply the spec to the storage slot the backend computed.
      // targetAppId and targetSection are pre-computed by the backend so
      // the frontend makes no decisions based on surface names.
      const { targetAppId, targetSection, spec, message: confirmMsg } = response;
      setSpec(targetAppId, targetSection, spec as BaseViewSpec | SidebarSpec | NavSpec);

      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: confirmMsg },
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
  }, [appId, activeSection, sidebarSpec, navSpec, getSpec, setSpec]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || isReadOnly) return;
    setInput('');
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: text },
    ]);
    await sendToBackend(text);
  }, [input, loading, isReadOnly, sendToBackend]);

  // Called when user picks an option from a needs_clarification message.
  // Uses opt.hint (a specific actionable message) when available; falls back
  // to originalMessage so the AI has the best possible context.
  const handleClarificationPick = useCallback(async (
    originalMessage: string,
    surface: string,
    optionLabel: string,
    hint?: string,
  ) => {
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: optionLabel },
    ]);
    await sendToBackend(hint ?? originalMessage, surface);
  }, [sendToBackend]);

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

  // Escape hatch: show banner when navbar or sidebar is hidden as a whole
  const isNavbarHidden  = navSpec?.visible === false;
  const isSidebarHidden = sidebarSpec?.visible === false;
  const showEscapeHatch = isNavbarHidden || isSidebarHidden;

  return (
    <div className="flex flex-col w-[300px] flex-shrink-0 border-l border-gray-200 bg-white h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0">
            <LogoMark size={24} />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-semibold text-gray-800">AI Assistant</span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-gray-400 truncate">{appLabel}</span>
              <span className="text-[10px] text-gray-300">›</span>
              <span className="text-[10px] font-medium text-indigo-500">{secLabel}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasSpec && (
            <button onClick={handleReset} className="p-1 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50" title="Reset to default">
              <RotateCcw size={13} />
            </button>
          )}
          <button onClick={closeChat} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Escape hatch — restore hidden navbar / sidebar */}
      {showEscapeHatch && (
        <div className="flex-shrink-0 px-3 py-2 bg-amber-50 border-b border-amber-100">
          <p className="text-[11px] font-medium text-amber-700 mb-1.5">Hidden surfaces:</p>
          <div className="flex flex-col gap-1">
            {isNavbarHidden && (
              <button
                onClick={() => {
                  setSpec(appId, 'nav', { version: '1.0', visible: true, hiddenTabs: [] } as NavSpec);
                  setMessages((prev) => [
                    ...prev,
                    { id: `r-nav-${Date.now()}`, role: 'assistant', content: 'Navbar restored.' },
                  ]);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-amber-700 bg-white border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors text-left"
              >
                <RotateCcw size={10} />
                Restore navbar
              </button>
            )}
            {isSidebarHidden && (
              <button
                onClick={() => {
                  const current = sidebarSpec;
                  setSpec('global', 'sidebar', { ...(current ?? { version: '1.0', items: [] }), visible: true } as SidebarSpec);
                  setMessages((prev) => [
                    ...prev,
                    { id: `r-sb-${Date.now()}`, role: 'assistant', content: 'Sidebar restored.' },
                  ]);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-amber-700 bg-white border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors text-left"
              >
                <RotateCcw size={10} />
                Restore sidebar
              </button>
            )}
          </div>
        </div>
      )}

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

          // Clarification message — question + option buttons
          if (msg.role === 'clarification' && msg.clarification) {
            const { options, originalMessage } = msg.clarification;
            return (
              <div key={msg.id} className="flex gap-2">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center mt-0.5">
                  <Bot size={11} className="text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl rounded-tl-sm px-3 py-2 text-[13px] leading-relaxed text-gray-800 mb-2">
                    {msg.content}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {options.map((opt) => (
                      <button
                        key={opt.surface + (opt.hint ?? opt.label)}
                        disabled={loading}
                        onClick={() => void handleClarificationPick(originalMessage, opt.surface, opt.label, opt.hint)}
                        className="text-left text-[12px] px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors disabled:opacity-50"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          // Regular user / assistant / error message
          return (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
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
