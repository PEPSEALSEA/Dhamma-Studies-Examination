import type { ReactNode } from "react";

export const ProgressBar = ({ value, ok, small }: { value: number; ok?: boolean; small?: boolean }) => (
  <div className={`bar${ok ? " ok" : ""}${small ? " sm" : ""}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
    <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

export const Ring = ({ value, label }: { value: number; label?: ReactNode }) => (
  <div className="ring" style={{ ["--p" as string]: Math.round(value) }}>
    <div>{label ?? `${Math.round(value)}%`}</div>
  </div>
);

export const Loading = ({ what = "ข้อมูล" }: { what?: string }) => <p className="muted">กำลังโหลด{what}…</p>;

export const ErrorBox = ({ msg }: { msg: string }) => <p className="err">โหลดข้อมูลไม่สำเร็จ: {msg}</p>;

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.id} className={o.id === value ? "on" : ""} onClick={() => onChange(o.id)} role="tab" aria-selected={o.id === value}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const SUBJECT_EMOJI: Record<string, string> = { dhamma: "📿", buddha: "☸️", benja: "🕊️", essay: "✍️" };
