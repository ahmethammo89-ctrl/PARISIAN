"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

export type ItemDraft = {
  file: File | null;
  previewUrl: string | null;
  note: string;
};

export default function ItemPhotoSlot({
  index,
  total,
  item,
  onChange,
}: {
  index: number;
  total: number;
  item: ItemDraft;
  onChange: (next: ItemDraft) => void;
}) {
  const t = useTranslations("order.customize");
  const inputRef = useRef<HTMLInputElement>(null);
  const [noteOpen, setNoteOpen] = useState(item.note.length > 0);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    onChange({ ...item, file, previewUrl: URL.createObjectURL(file) });
  }

  return (
    <div className="flex w-40 shrink-0 flex-col gap-2 snap-start">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-sky-light bg-base-soft">
        <span className="absolute start-2 top-2 z-10 rounded-full bg-navy-dark/80 px-2 py-0.5 text-[11px] font-medium text-base backdrop-blur-sm">
          {t("itemLabel", { n: index, total })}
        </span>

        {item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-sky transition-colors hover:bg-sky-pale active:bg-sky-pale"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 8a2 2 0 012-2h1.2a1 1 0 00.9-.55l.6-1.2A1 1 0 0110 3.7h4a1 1 0 01.9.55l.6 1.2a1 1 0 00.9.55H18a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V8z"
              />
              <circle cx="12" cy="13" r="3.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xs font-medium">{t("addPhoto")}</span>
          </button>
        )}

        {item.previewUrl && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-x-0 bottom-0 bg-navy-dark/70 py-1.5 text-xs font-medium text-base backdrop-blur-sm transition-opacity hover:bg-navy-dark/85"
          >
            {t("retakePhoto")}
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {noteOpen ? (
        <textarea
          value={item.note}
          onChange={(e) => onChange({ ...item, note: e.target.value })}
          placeholder={t("notePlaceholder")}
          rows={2}
          className="w-full resize-none rounded-lg border border-sky-light bg-base px-2 py-1.5 text-xs text-navy-dark focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky/40"
        />
      ) : (
        <button
          type="button"
          onClick={() => setNoteOpen(true)}
          className="text-start text-xs text-sky underline-offset-2 hover:underline"
        >
          {t("addNote")}
        </button>
      )}
    </div>
  );
}
