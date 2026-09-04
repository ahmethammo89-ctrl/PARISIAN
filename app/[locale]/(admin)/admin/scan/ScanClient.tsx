"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { itemStatusOptions } from "@/lib/orderFlow";
import StatusBadge from "@/components/StatusBadge";
import type { OrderItemRow, OrderItemPhotoRow, LocalizedText, ItemStatus, PhotoType } from "@/types/database";

type Photo = OrderItemPhotoRow & { signedUrl: string | null };
type Lookup = {
  item: OrderItemRow;
  serviceName?: LocalizedText;
  order: { id: string; order_number: string; status: string; customer_id: string };
  customer: { full_name: string | null; phone: string } | null;
  photos: Photo[];
};

export default function ScanClient({ initialCode }: { initialCode: string }) {
  const t = useTranslations("admin.scan");
  const tsItem = useTranslations("status.item");
  const locale = useLocale() as "ar" | "en" | "fr";

  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<Lookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoType, setPhotoType] = useState<PhotoType>("staff_intake");

  useEffect(() => {
    setCameraSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  useEffect(() => {
    if (initialCode) lookup(initialCode);
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookup(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const supabase = createClient();
      const { data: item } = await supabase.from("order_items").select("*").eq("barcode", value).maybeSingle();
      if (!item) {
        setError(t("notFound"));
        return;
      }
      const [{ data: order }, { data: service }, { data: photos }] = await Promise.all([
        supabase.from("orders").select("id, order_number, status, customer_id").eq("id", item.order_id).single(),
        supabase.from("services").select("name").eq("id", item.service_id).single(),
        supabase.from("order_item_photos").select("*").eq("order_item_id", item.id).order("uploaded_at"),
      ]);
      const { data: customer } = order
        ? await supabase.from("profiles").select("full_name, phone").eq("id", order.customer_id).single()
        : { data: null };

      const paths = (photos ?? []).map((p) => p.photo_url);
      const { data: signed } = paths.length
        ? await supabase.storage.from("item-photos").createSignedUrls(paths, 3600)
        : { data: [] };
      const signedMap = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

      setResult({
        item,
        serviceName: service?.name as LocalizedText | undefined,
        order: order!,
        customer: customer ?? null,
        photos: (photos ?? []).map((p) => ({ ...p, signedUrl: signedMap.get(p.photo_url) ?? null })),
      });
    } catch {
      setError(t("notFound"));
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(status: ItemStatus) {
    if (!result) return;
    setBusy(`status:${status}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/items/${result.item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setResult({ ...result, item: { ...result.item, status } });
    } catch {
      setError(t("actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function uploadPhoto(file: File) {
    if (!result) return;
    setBusy("photo");
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error();
      const path = `${result.order.customer_id}/${result.item.id}/staff-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("item-photos")
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;
      await supabase.from("order_item_photos").insert({
        order_item_id: result.item.id,
        photo_url: path,
        photo_type: photoType,
        uploaded_by: user.id,
      });
      const { data: signedData } = await supabase.storage.from("item-photos").createSignedUrl(path, 3600);
      setResult({
        ...result,
        photos: [
          ...result.photos,
          {
            id: path,
            order_item_id: result.item.id,
            photo_url: path,
            photo_type: photoType,
            uploaded_by: user.id,
            uploaded_at: new Date().toISOString(),
            signedUrl: signedData?.signedUrl ?? null,
          },
        ],
      });
    } catch {
      setError(t("actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:px-6">
      <h1 className="font-heading mb-4 text-2xl text-navy-dark">{t("title")}</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup(code);
        }}
        className="flex gap-2"
      >
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("inputPlaceholder")}
          autoFocus
          className="min-w-0 flex-1 rounded-full border border-sky-light bg-base px-4 py-2.5 font-mono text-sm outline-none focus:border-navy"
        />
        <button type="submit" disabled={loading} className="shrink-0 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-base hover:bg-navy-dark disabled:opacity-50">
          {loading ? t("looking") : t("go")}
        </button>
      </form>

      {cameraSupported && (
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-navy py-2.5 text-sm font-semibold text-navy-dark hover:bg-sky-pale"
        >
          {t("scanCamera")}
        </button>
      )}
      <p className="mt-2 text-center text-xs text-navy/50">{t("hidHint")}</p>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {result && (
        <div className="mt-6 rounded-2xl border border-sky-light bg-base-soft p-4">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <p className="font-medium text-navy-dark">{result.serviceName?.[locale] ?? result.serviceName?.en}</p>
              <p className="font-mono text-xs text-navy/60">{result.item.barcode}</p>
            </div>
            <StatusBadge kind="item" status={result.item.status} />
          </div>

          <Link href={`/admin/orders/${result.order.id}`} className="text-sm text-navy hover:underline">
            {result.order.order_number} — {result.customer?.full_name || result.customer?.phone}
          </Link>

          {(result.item.fold_type || result.item.starch_level || result.item.stain_notes) && (
            <p className="mt-2 text-xs text-navy-dark/70">
              {[result.item.fold_type, result.item.starch_level, result.item.stain_notes].filter(Boolean).join(" · ")}
            </p>
          )}

          {result.photos.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {result.photos.map(
                (p) =>
                  p.signedUrl && (
                    <a key={p.id} href={p.signedUrl} target="_blank" rel="noopener noreferrer" className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.signedUrl} alt="" className="h-20 w-20 rounded-lg border border-sky-light object-cover" />
                      <span className="absolute -end-1 -top-1 rounded-full bg-navy px-1.5 py-0.5 text-[8px] font-semibold text-base">
                        {p.photo_type === "customer_intake" ? "C" : p.photo_type === "staff_intake" ? "S" : "D"}
                      </span>
                    </a>
                  )
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-1.5">
            {itemStatusOptions(result.item.status).map((s) => (
              <button
                key={s}
                disabled={busy !== null}
                onClick={() => updateStatus(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  s === "lost" || s === "damaged"
                    ? "border border-red-300 text-red-700 hover:bg-red-50"
                    : "border border-navy/30 text-navy-dark hover:bg-sky-pale"
                }`}
              >
                {busy === `status:${s}` ? t("saving") : tsItem(s)}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-sky-light pt-3">
            <select
              value={photoType}
              onChange={(e) => setPhotoType(e.target.value as PhotoType)}
              className="rounded-full border border-sky-light bg-base px-2.5 py-1.5 text-xs outline-none"
            >
              <option value="staff_intake">{t("photoIntake")}</option>
              <option value="staff_delivery">{t("photoDelivery")}</option>
            </select>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => photoInputRef.current?.click()}
              className="flex-1 rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-base hover:bg-navy-dark disabled:opacity-50"
            >
              {busy === "photo" ? t("saving") : t("addStaffPhoto")}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadPhoto(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      )}

      {cameraOpen && (
        <CameraScanModal
          onDetected={(value) => {
            setCameraOpen(false);
            setCode(value);
            lookup(value);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}

function CameraScanModal({ onDetected, onClose }: { onDetected: (value: string) => void; onClose: () => void }) {
  const t = useTranslations("admin.scan");
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [err, setErr] = useState(false);

  useEffect(() => {
    const Detector = window.BarcodeDetector;
    if (!Detector) {
      setErr(true);
      return;
    }
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new Detector!({ formats: ["qr_code", "code_128", "ean_13"] });
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              onDetectedRef.current(codes[0].rawValue);
              return;
            }
          } catch {
            // transient decode error — keep scanning
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setErr(true);
      }
    }
    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-navy-dark/90 px-6">
      {err ? (
        <p className="text-sm text-base">{t("cameraError")}</p>
      ) : (
        <video ref={videoRef} muted playsInline className="w-full max-w-sm rounded-2xl" />
      )}
      <button onClick={onClose} className="mt-6 rounded-full border-2 border-base px-6 py-2 text-sm font-semibold text-base">
        {t("close")}
      </button>
    </div>
  );
}
