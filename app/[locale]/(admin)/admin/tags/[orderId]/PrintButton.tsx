"use client";

export default function PrintButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-base hover:bg-navy-dark"
    >
      {label}
    </button>
  );
}
