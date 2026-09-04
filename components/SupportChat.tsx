"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import type { SupportMessageRow, UserRole } from "@/types/database";

function formatSeconds(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Preferred first, falls back through whatever the browser actually supports. */
const AUDIO_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function pickRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return AUDIO_MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

export default function SupportChat({
  customerId,
  currentUserId,
  senderRole,
  initialMessages,
}: {
  customerId: string;
  currentUserId: string;
  senderRole: UserRole;
  initialMessages: SupportMessageRow[];
}) {
  const t = useTranslations("support");
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micError, setMicError] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const actionRef = useRef<"send" | "cancel">("send");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`support-messages-${customerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `customer_id=eq.${customerId}` },
        (payload) => {
          const row = payload.new as SupportMessageRow;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError(false);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("support_messages")
      .insert({ customer_id: customerId, sender_id: currentUserId, sender_role: senderRole, body: text })
      .select("*")
      .single();
    setSending(false);
    if (err) {
      setError(true);
      return;
    }
    if (data) setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    setBody("");
  }

  async function startRecording() {
    setMicError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMimeType();
      if (mimeType === null) throw new Error("unsupported");
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      actionRef.current = "send";

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false);
        if (actionRef.current === "send" && chunksRef.current.length > 0) {
          void uploadVoiceNote(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
        }
        chunksRef.current = [];
      };

      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setMicError(true);
    }
  }

  function stopRecording(action: "send" | "cancel") {
    actionRef.current = action;
    recorderRef.current?.stop();
  }

  async function uploadVoiceNote(blob: Blob) {
    setSending(true);
    setError(false);
    const supabase = createClient();
    const ext = blob.type.includes("mp4") ? "m4a" : "webm";
    const path = `${customerId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("chat-audio").upload(path, blob, { contentType: blob.type });
    if (uploadErr) {
      setSending(false);
      setError(true);
      return;
    }
    const { data, error: err } = await supabase
      .from("support_messages")
      .insert({ customer_id: customerId, sender_id: currentUserId, sender_role: senderRole, audio_path: path })
      .select("*")
      .single();
    setSending(false);
    if (err) {
      setError(true);
      return;
    }
    if (data) setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
  }

  return (
    <div className="rounded-2xl border border-sky-light bg-base-soft p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy">{t("title")}</h2>

      <div className="mb-3 max-h-96 space-y-2 overflow-y-auto">
        {messages.length === 0 && <p className="text-sm text-navy-dark/50">{t("empty")}</p>}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-navy text-base" : "bg-white text-navy-dark border border-sky-light"}`}>
                {m.audio_path ? <VoiceBubble path={m.audio_path} mine={mine} /> : <p>{m.body}</p>}
                <p className={`mt-1 text-[10px] ${mine ? "text-base/60" : "text-navy-dark/40"}`}>
                  {m.sender_role === "customer" ? t("customer") : t("staff")} ·{" "}
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && <p className="mb-2 text-xs text-red-700">{t("sendFailed")}</p>}
      {micError && <p className="mb-2 text-xs text-red-700">{t("micError")}</p>}

      {recording ? (
        <div className="flex items-center gap-2 rounded-full border border-red-300 bg-white px-3 py-2">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-600" aria-hidden="true" />
          <span className="flex-1 text-sm font-medium text-navy-dark">{t("recording", { seconds: formatSeconds(recordSeconds) })}</span>
          <button
            type="button"
            onClick={() => stopRecording("cancel")}
            aria-label={t("cancelRecording")}
            className="rounded-full px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            {t("cancelRecording")}
          </button>
          <button
            type="button"
            onClick={() => stopRecording("send")}
            aria-label={t("sendRecording")}
            className="rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-base hover:bg-navy-dark"
          >
            {t("sendRecording")}
          </button>
        </div>
      ) : (
        <form onSubmit={send} className="flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("placeholder")}
            className="min-w-0 flex-1 rounded-full border border-navy-dark/15 bg-white px-4 py-2 text-sm focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/30"
          />
          <button
            type="button"
            onClick={startRecording}
            disabled={sending}
            aria-label={t("recordStart")}
            className="shrink-0 rounded-full border border-navy/20 px-3 py-2 text-sm text-navy-dark hover:bg-sky-pale disabled:opacity-50"
          >
            🎤
          </button>
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="shrink-0 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-base hover:bg-navy-dark disabled:opacity-50"
          >
            {t("send")}
          </button>
        </form>
      )}
    </div>
  );
}

function VoiceBubble({ path, mine }: { path: string; mine: boolean }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.storage
      .from("chat-audio")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled && data) setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!url) return <p className={`text-sm ${mine ? "text-base/80" : "text-navy-dark/60"}`}>🎤 …</p>;
  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <audio controls src={url} className="h-9 max-w-[220px]" style={{ filter: mine ? "invert(1)" : undefined }} />;
}
