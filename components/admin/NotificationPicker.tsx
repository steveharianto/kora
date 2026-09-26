"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MessageCircle,
  Send,
  Copy,
  Check,
  ChevronDown,
  ExternalLink,
  AlertTriangle,
  Loader2,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Paperclip,
  FileText,
} from "lucide-react";
import {
  listNotificationsForEntity,
  previewNotification,
  sendNotificationNow,
  type NotificationListItem,
  type NotificationPreview,
} from "@/app/actions/notifications";
import type { Entity } from "@/lib/notifications/registry";

interface Props {
  entity: Entity;
  entityId: string;
  buttonLabel?: string;
  className?: string;
  onSent?: () => void;
}

type SendStage = "idle" | "generating" | "sending";

function formatRel(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function NotificationPicker({
  entity,
  entityId,
  buttonLabel = "WhatsApp",
  className,
  onSent,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotificationListItem[]>([]);
  const [kind, setKind] = useState<string>("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<NotificationPreview | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [stage, setStage] = useState<SendStage>("idle");
  const [flash, setFlash] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [attachEnabled, setAttachEnabled] = useState(true);

  const currentItem = useMemo(
    () => items.find((i) => i.kind === kind) || null,
    [items, kind],
  );
  const requiresReason = currentItem?.requiresReasonInput ?? false;
  const supportsAttachment = currentItem?.hasAttachment ?? false;
  const busy = stage !== "idle";

  /* Reset transient state when closing */
  useEffect(() => {
    if (!isOpen) {
      setFlash(null);
      setPreview(null);
      setReason("");
      setCopied(false);
      setStage("idle");
    }
  }, [isOpen]);

  /* Auto-dismiss flash */
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  /* Load list on open */
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setLoadingList(true);
    listNotificationsForEntity(entity, entityId).then((res) => {
      if (!alive) return;
      setItems(res.items);
      setKind((prev) => prev || res.items[0]?.kind || "");
      setLoadingList(false);
    });
    return () => {
      alive = false;
    };
  }, [isOpen, entity, entityId]);

  /* Default the attach toggle on for kinds that support it */
  useEffect(() => {
    if (supportsAttachment) setAttachEnabled(true);
  }, [kind, supportsAttachment]);

  /* Refresh preview on kind / reason change (debounced) */
  useEffect(() => {
    if (!isOpen || !kind) return;
    let alive = true;
    setLoadingPreview(true);

    const timer = setTimeout(() => {
      const overrides: Record<string, string> = {};
      if (requiresReason && reason.trim()) {
        overrides.REJECTION_REASON = reason.trim();
      }
      previewNotification(entity, entityId, kind, overrides).then((res) => {
        if (!alive) return;
        setPreview(res);
        setLoadingPreview(false);
      });
    }, 250);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [isOpen, kind, reason, entity, entityId, requiresReason]);

  const canSend = useMemo(() => {
    if (!preview) return false;
    if (!preview.to) return false;
    if (preview.missing.length > 0) return false;
    if (busy) return false;
    return true;
  }, [preview, busy]);

  const handleCopy = async () => {
    if (!preview?.text) return;
    try {
      await navigator.clipboard.writeText(preview.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFlash({ type: "err", text: "Could not copy to clipboard." });
    }
  };

  const handleSend = async () => {
    if (!kind) return;
    setFlash(null);

    const overrides: Record<string, string> = {};
    if (requiresReason && reason.trim()) {
      overrides.REJECTION_REASON = reason.trim();
    }

    // Staged progress: PDF generation runs before the actual send.
    setStage(supportsAttachment && attachEnabled ? "generating" : "sending");

    const res = await sendNotificationNow(entity, entityId, kind, overrides, {
      attach: supportsAttachment && attachEnabled,
    });

    setStage("idle");

    if (res.sent) {
      setFlash({
        type: "ok",
        text: res.attachmentSent
          ? "Sent via Fonnte with PDF attached."
          : "Sent via Fonnte.",
      });

      const [list, prev] = await Promise.all([
        listNotificationsForEntity(entity, entityId),
        previewNotification(entity, entityId, kind, overrides),
      ]);
      setItems(list.items);
      setPreview(prev);
      onSent?.();
    } else {
      setFlash({
        type: "err",
        text: res.error || "Fonnte send failed.",
      });
      const prev = await previewNotification(entity, entityId, kind, overrides);
      setPreview(prev);
    }
  };

  const sendButtonLabel = () => {
    if (stage === "generating") return "Generating PDF…";
    if (stage === "sending") return "Sending…";
    return "Send via Fonnte";
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          className ||
          "px-3 py-1.5 border border-line bg-card rounded-lg text-xs font-medium hover:bg-[#F6F4EF] flex items-center gap-1.5 cursor-pointer"
        }
        title="Send a WhatsApp notification"
      >
        <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" strokeWidth={1.8} />
        {buttonLabel}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-line rounded-xl w-full max-w-2xl shadow-xl relative flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-line">
              <div>
                <h2 className="font-serif text-[20px] font-normal">
                  Send WhatsApp
                </h2>
                <p className="text-[11.5px] text-muted mt-0.5">
                  {entity.charAt(0).toUpperCase() + entity.slice(1)} · {entityId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !busy && setIsOpen(false)}
                disabled={busy}
                className="text-muted hover:text-ink p-1 cursor-pointer disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4 overflow-y-auto">
              {/* Notification selector */}
              <div>
                <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1 font-medium">
                  Notification
                </label>
                {loadingList ? (
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading…
                  </div>
                ) : items.length === 0 ? (
                  <p className="text-xs text-muted">
                    No notifications available for this entity.
                  </p>
                ) : (
                  <div className="relative">
                    <select
                      value={kind}
                      onChange={(e) => setKind(e.target.value)}
                      disabled={busy}
                      className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-1 focus:ring-wine focus:outline-none appearance-none pr-9 cursor-pointer"
                    >
                      {items.map((it) => {
                        const sentLabel = it.lastSentAt
                          ? `sent ${formatRel(it.lastSentAt)}${
                              it.lastSentStatus === "failed" ? " (failed)" : ""
                            }`
                          : "never sent";
                        return (
                          <option key={it.kind} value={it.kind}>
                            {it.label} — {sentLabel}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="w-4 h-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                )}
                {currentItem && (
                  <p className="text-[11px] text-muted mt-1 leading-relaxed">
                    {currentItem.description}
                    {currentItem.autoTriggered && " · Usually sent automatically."}
                  </p>
                )}
              </div>

              {/* Reason input */}
              {requiresReason && (
                <div>
                  <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1 font-medium">
                    Reason <span className="text-bad">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={busy}
                    placeholder="Explain what needs fixing — this appears in the message."
                    className="w-full text-xs border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-1 focus:ring-wine focus:outline-none disabled:opacity-60"
                  />
                </div>
              )}

              {/* Missing vars warning */}
              {preview && preview.missing.length > 0 && (
                <div className="p-3 bg-warn-bg border border-[#F1DFB7] rounded-lg text-xs text-warn-ink flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    Missing required fields:{" "}
                    <strong>
                      {preview.missing.map((m) => m.label).join(", ")}
                    </strong>
                    .
                  </span>
                </div>
              )}

              {/* Missing phone warning */}
              {preview && !preview.to && preview.error !== "Unauthorized" && (
                <div className="p-3 bg-bad-bg border border-[#D9A79C] rounded-lg text-xs text-bad flex items-start gap-2">
                  <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    No phone number on file for this customer. Add one and try
                    again.
                  </span>
                </div>
              )}

              {/* Generic error */}
              {preview?.error && !preview.text && (
                <div className="p-3 bg-bad-bg border border-[#D9A79C] rounded-lg text-xs text-bad">
                  {preview.error}
                </div>
              )}

              {/* Preview */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted font-medium">
                    Preview
                  </label>
                  {loadingPreview && (
                    <span className="text-[10px] text-muted flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> updating…
                    </span>
                  )}
                </div>
                <textarea
                  readOnly
                  rows={6}
                  value={preview?.text || ""}
                  placeholder="Preview will appear here…"
                  className="w-full text-[12.5px] font-mono border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-ink resize-none focus:outline-none"
                />
                <div className="flex items-center justify-between text-[11px] text-muted mt-1">
                  <span>
                    To:{" "}
                    <strong className="text-ink font-medium">
                      {preview?.to || "—"}
                    </strong>
                  </span>
                  <span>{preview?.text?.length || 0} chars</span>
                </div>
              </div>

              {/* Attachment row */}
              {supportsAttachment && preview?.attachmentFilename && (
                <label className="flex items-center gap-2.5 p-2.5 border border-line rounded-lg bg-[#FDFCFA] cursor-pointer hover:bg-[#F6F4EF] transition select-none">
                  <input
                    type="checkbox"
                    checked={attachEnabled}
                    onChange={(e) => setAttachEnabled(e.target.checked)}
                    disabled={busy}
                    className="rounded border-line text-wine focus:ring-wine"
                  />
                  <FileText className="w-4 h-4 text-wine-ink flex-shrink-0" strokeWidth={1.8} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-ink flex items-center gap-1.5">
                      <Paperclip className="w-3 h-3 text-muted" />
                      Attach {preview.attachmentLabel || "file"}
                    </div>
                    <div className="text-[11px] text-muted font-mono truncate">
                      {preview.attachmentFilename}
                    </div>
                  </div>
                </label>
              )}

              {/* Last-sent info */}
              {preview?.lastSentAt && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted">
                  <Clock className="w-3 h-3" />
                  Last sent {formatRel(preview.lastSentAt)}
                  {preview.lastSentStatus === "failed" && (
                    <span className="text-bad">· failed</span>
                  )}
                </div>
              )}

              {/* Flash */}
              {flash && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                    flash.type === "ok"
                      ? "bg-ok-bg border border-[#CAD3C5] text-ok"
                      : "bg-bad-bg border border-[#D9A79C] text-bad"
                  }`}
                >
                  {flash.type === "ok" ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {flash.text}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 flex-wrap px-5 py-4 border-t border-line bg-[#FDFCFA] rounded-b-xl">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!preview?.text || busy}
                  className="px-3 py-1.5 border border-line bg-card rounded-lg text-xs font-medium hover:bg-[#F6F4EF] disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-ok" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
                {preview?.waUrl && (
                  <a
                    href={preview.waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 border border-line bg-card rounded-lg text-xs font-medium hover:bg-[#F6F4EF] flex items-center gap-1.5"
                    title="Open this message in WhatsApp to send manually"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in WhatsApp
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="px-4 py-1.5 bg-wine text-white rounded-lg text-xs font-medium hover:bg-[#181E15] transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5 min-w-[140px] justify-center"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {sendButtonLabel()}
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Send via Fonnte
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
