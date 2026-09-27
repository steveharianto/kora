'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, AtSign, Loader2 } from 'lucide-react';
import { postChatMessage, type ChatEntity } from '@/app/actions/notes';

export interface Admin {
  id: string;
  name: string;
  role: string;
}

interface ChatLog {
  id: number;
  admin_id: string | null;
  admin_name: string;
  new_value: string | null;
  details: { mentions?: string[] } | null;
  created_at: string;
}

interface Props {
  entity: ChatEntity;
  entityId: string;
  currentAdmin: { id: string; name: string } | null;
  admins: Admin[];
  logs: ChatLog[];
  title?: string;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function containsMention(text: string, name: string) {
  if (!name) return false;
  const needle = `@${name}`;
  let idx = text.indexOf(needle);
  while (idx !== -1) {
    const after = text[idx + needle.length];
    if (!after || !/[a-zA-Z0-9_]/.test(after)) return true;
    idx = text.indexOf(needle, idx + 1);
  }
  return false;
}

export default function EntityChat({
  entity,
  entityId,
  currentAdmin,
  admins,
  logs,
  title = 'Log Note',
}: Props) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [suggestionIndex, setSuggestionIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sort chat messages ASC (oldest at top, newest at bottom).
  const sorted = useMemo(
    () =>
      [...logs].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [logs],
  );

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sorted.length]);

  const filteredAdmins = useMemo(() => {
    const q = suggestionQuery.toLowerCase();
    return admins
      .filter((a) => a.id !== currentAdmin?.id)
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [admins, suggestionQuery, currentAdmin]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);

    const cursor = e.target.selectionStart ?? value.length;
    const beforeCursor = value.slice(0, cursor);
    const atMatch = beforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setSuggestionQuery(atMatch[1]);
      setShowSuggestions(true);
      setSuggestionIndex(0);
    } else {
      setShowSuggestions(false);
    }
  };

  const insertMention = (admin: Admin) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursor = textarea.selectionStart ?? text.length;
    const before = text.slice(0, cursor);
    const after = text.slice(cursor);
    const newBefore = before.replace(/@\w*$/, `@${admin.name} `);
    const newText = newBefore + after;
    setText(newText);
    setShowSuggestions(false);
    setTimeout(() => {
      textarea.focus();
      const pos = newBefore.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError('');

    // Compute the mentioned admin UUIDs from the plain-text mentions.
    const mentionedIds = admins
      .filter((a) => a.id !== currentAdmin?.id)
      .filter((a) => containsMention(trimmed, a.name))
      .map((a) => a.id);

    const res = await postChatMessage(entity, entityId, trimmed, mentionedIds);
    setSending(false);

    if (res?.error) {
      setError(res.error);
      return;
    }
    setText('');
    setShowSuggestions(false);
    router.refresh();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && filteredAdmins.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIndex((i) => (i + 1) % filteredAdmins.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIndex(
          (i) => (i - 1 + filteredAdmins.length) % filteredAdmins.length,
        );
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        insertMention(filteredAdmins[suggestionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }

    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-serif text-[18px] font-normal">
          {title}{' '}
          <span className="text-[12px] text-muted font-sans">
            — internal team only
          </span>
        </h3>
        <span className="text-[10.5px] tracking-wider uppercase text-muted">
          {sorted.length} {sorted.length === 1 ? 'message' : 'messages'}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3"
        style={{ minHeight: 220, maxHeight: 400 }}
      >
        {sorted.length === 0 ? (
          <p className="text-xs text-muted text-center py-10">
            No messages yet — start the conversation below.
          </p>
        ) : (
          sorted.map((log) => (
            <Message
              key={log.id}
              log={log}
              currentAdminId={currentAdmin?.id ?? null}
              admins={admins}
            />
          ))
        )}
      </div>

      <div className="relative border-t border-line pt-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={2}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Message the team…  type @ to mention"
              disabled={sending}
              className="w-full text-xs border border-line rounded-lg p-2.5 pr-8 bg-[#FDFCFA] focus:ring-1 focus:ring-wine focus:outline-none resize-none disabled:opacity-60"
            />
            <AtSign className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-muted pointer-events-none" />
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !text.trim()}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-wine text-white rounded-lg hover:bg-[#181E15] transition disabled:opacity-50 cursor-pointer"
            title="Send"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {showSuggestions && filteredAdmins.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-64 bg-white border border-line rounded-lg shadow-lg max-h-48 overflow-y-auto z-20">
            {filteredAdmins.map((a, i) => (
              <button
                key={a.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(a);
                }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition cursor-pointer ${
                  i === suggestionIndex ? 'bg-[#F6F4EF]' : 'hover:bg-[#F6F4EF]'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-wine-soft text-wine-ink flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {a.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-ink truncate">
                    {a.name}
                  </span>
                  <span className="block text-[10.5px] text-muted capitalize">
                    {a.role}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-[11px] text-bad mt-2">{error}</p>}
      </div>
    </div>
  );
}

/* ── Single message bubble ───────────────────────────────────────── */

function Message({
  log,
  currentAdminId,
  admins,
}: {
  log: ChatLog;
  currentAdminId: string | null;
  admins: Admin[];
}) {
  const isSelf = Boolean(currentAdminId) && log.admin_id === currentAdminId;
  const mentions = log.details?.mentions ?? [];
  const mentionedMe =
    Boolean(currentAdminId) && mentions.includes(currentAdminId as string);
  const initial = (log.admin_name || '?').charAt(0).toUpperCase();

  return (
    <div className={`flex gap-2 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${
          isSelf ? 'bg-wine text-white' : 'bg-[#EFEBE2] text-ink'
        }`}
      >
        {initial}
      </div>

      <div
        className={`min-w-0 max-w-[82%] flex flex-col ${
          isSelf ? 'items-end' : 'items-start'
        }`}
      >
        <div
          className={`text-[10px] text-muted mb-0.5 flex items-center gap-1.5 flex-wrap ${
            isSelf ? 'flex-row-reverse' : 'flex-row'
          }`}
        >
          <span className="font-medium text-ink">
            {isSelf ? 'You' : log.admin_name}
          </span>
          <span>{formatTime(log.created_at)}</span>
          {mentionedMe && !isSelf && (
            <span className="px-1.5 py-0.5 rounded bg-wine-soft text-wine-ink font-semibold text-[9px] uppercase tracking-wide">
              Mentioned you
            </span>
          )}
        </div>

        <div
          className={`text-[12.5px] leading-relaxed px-3 py-2 rounded-lg break-words whitespace-pre-wrap ${
            isSelf
              ? 'bg-wine text-white'
              : mentionedMe
                ? 'bg-wine-soft text-ink border border-wine/20'
                : 'bg-[#F6F4EF] text-ink'
          }`}
        >
          {renderWithMentions(log.new_value || '', admins, isSelf)}
        </div>
      </div>
    </div>
  );
}

/* ── Mention highlighter ─────────────────────────────────────────── */

function renderWithMentions(
  text: string,
  admins: Admin[],
  isSelf: boolean,
): React.ReactNode {
  if (!text) return null;
  const names = admins
    .map((a) => a.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length); // longest first — @Steve > @Ste

  if (names.length === 0) return text;

  // Match @Name where the next char isn't a word char (so @Steve doesn't
  // match inside @Steven).
  const pattern = new RegExp(
    `@(${names.map(escapeRegex).join('|')})(?![a-zA-Z0-9_])`,
    'g',
  );

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span
        key={key++}
        className={`inline-flex items-center px-1 rounded font-medium ${
          isSelf
            ? 'bg-white/25 text-white'
            : 'bg-wine-soft text-wine-ink'
        }`}
      >
        @{match[1]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
