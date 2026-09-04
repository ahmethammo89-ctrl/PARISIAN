"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import type { OrderMessageRow, UserRole } from "@/types/database";

export default function OrderChat({
  orderId,
  currentUserId,
  senderRole,
  initialMessages,
}: {
  orderId: string;
  currentUserId: string;
  senderRole: UserRole;
  initialMessages: OrderMessageRow[];
}) {
  const t = useTranslations("order.chat");
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`order-messages-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const row = payload.new as OrderMessageRow;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError(false);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("order_messages")
      .insert({ order_id: orderId, sender_id: currentUserId, sender_role: senderRole, body: text })
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

  return (
    <div className="rounded-2xl border border-sky-light bg-base-soft p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy">{t("title")}</h2>

      <div className="mb-3 max-h-72 space-y-2 overflow-y-auto">
        {messages.length === 0 && <p className="text-sm text-navy-dark/50">{t("empty")}</p>}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-navy text-base" : "bg-white text-navy-dark border border-sky-light"}`}>
                <p>{m.body}</p>
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

      <form onSubmit={send} className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("placeholder")}
          className="min-w-0 flex-1 rounded-full border border-navy-dark/15 bg-white px-4 py-2 text-sm focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/30"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="shrink-0 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-base hover:bg-navy-dark disabled:opacity-50"
        >
          {t("send")}
        </button>
      </form>
    </div>
  );
}
