"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface TrendPoint {
  label: string;
  value: number;
}

const nf = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}k` : String(Math.round(n));

/**
 * กราฟพื้นที่แสดงแนวโน้มต่องวด: แท็บเลือกช่วง, เลื่อนเมาส์/โฟกัสด้วยคีย์บอร์ดเพื่อดูค่า
 * มีตารางสำรองสำหรับโปรแกรมอ่านหน้าจอ
 */
export function TrendChart({ data, unit = "บาท" }: { data: TrendPoint[]; unit?: string }) {
  const ranges = [3, 6, 12].filter((n) => n <= Math.max(3, data.length));
  const [range, setRange] = useState(Math.min(6, data.length) || 3);
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(520);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  });
  const pts = data.slice(-range);

  if (pts.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">ยังไม่มีข้อมูลผลคำนวณให้แสดงกราฟ</p>;
  }

  const W = boxW;
  const H = 240;
  const pad = { l: 44, r: 12, t: 16, b: 28 };
  const max = Math.max(...pts.map((p) => p.value), 1);
  const x = (i: number) => pad.l + (pts.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (pts.length - 1));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const area = `${line} L${x(pts.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`;
  const active = hover ?? pts.length - 1;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span />
        <div role="tablist" aria-label="ช่วงงวดที่แสดง" className="inline-flex gap-1 text-xs">
          {ranges.map((n) => (
            <button
              key={n}
              role="tab"
              type="button"
              aria-selected={range === n}
              onClick={() => {
                setRange(n);
                setHover(null);
              }}
              className={cn(
                "min-h-8 rounded-lg px-2.5 font-medium transition-colors",
                range === n ? "bg-soft text-ink" : "text-muted hover:text-ink",
              )}
            >
              {n} งวด
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto pt-20">
      <div ref={boxRef} className="relative min-w-[280px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`กราฟแนวโน้มยอดจ่ายสุทธิ ${pts.length} งวดล่าสุด`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1565c0" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#1565c0" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(max * t)} y2={y(max * t)} stroke="#e3e9f2" strokeDasharray={t ? "4 4" : undefined} />
            <text x={pad.l - 8} y={y(max * t) + 4} textAnchor="end" fontSize="13" fill="#5f7189">
              {compact(max * t)}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke="#1565c0" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={p.label + i}>
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="13" fill="#5f7189">
              {p.label.length > 10 ? `${p.label.slice(0, 9)}…` : p.label}
            </text>
            {i === active ? (
              <>
                <line x1={x(i)} x2={x(i)} y1={pad.t} y2={H - pad.b} stroke="#1565c0" strokeOpacity="0.35" strokeDasharray="3 3" />
                <circle cx={x(i)} cy={y(p.value)} r="5" fill="#fff" stroke="#1565c0" strokeWidth="2.5" />
              </>
            ) : null}
            <rect
              x={x(i) - 22}
              y={pad.t}
              width="44"
              height={H - pad.t - pad.b}
              fill="transparent"
              tabIndex={0}
              role="presentation"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          </g>
        ))}
      </svg>
      <div
        aria-hidden
        className="pointer-events-none absolute z-10 w-40 -translate-x-1/2 -translate-y-full rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg"
        style={{ left: `clamp(80px, ${(x(active) / W) * 100}%, calc(100% - 80px))`, top: `${(y(pts[active].value) / H) * 100}%`, marginTop: -12 }}
      >
        <p className="text-muted">{pts[active].label}</p>
        <p className="num mt-0.5 !text-left text-sm font-semibold text-ink">{nf.format(pts[active].value)} {unit}</p>
      </div>
      </div>
      </div>

      <table className="sr-only">
        <caption>ยอดจ่ายสุทธิต่องวด</caption>
        <tbody>
          {pts.map((p) => (
            <tr key={p.label}>
              <th scope="row">{p.label}</th>
              <td>{nf.format(p.value)} {unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface Slice {
  label: string;
  value: number;
  color: string;
}

/** โดนัทครึ่งวงกลมแสดงสัดส่วน พร้อมคำอธิบายสีเป็นข้อความ */
export function HalfDonut({
  slices,
  centerLabel,
  center,
  legend = true,
}: {
  slices: Slice[];
  centerLabel: string;
  /** ข้อความตรงกลาง (ไม่ระบุ = ผลรวมของทุกส่วน) */
  center?: string;
  legend?: boolean;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const R = 80;
  const C = Math.PI * R;
  let offset = 0;
  return (
    <div>
      <div className="relative mx-auto w-full max-w-[260px]">
        <svg viewBox="0 0 200 110" className="w-full" role="img" aria-label={`สัดส่วน ${slices.map((s) => `${s.label} ${s.value}`).join(" ")}`}>
          <path d="M20,100 A80,80 0 0 1 180,100" fill="none" stroke="#eef1f6" strokeWidth="18" strokeLinecap="round" />
          {total > 0
            ? slices.map((s) => {
                const len = (s.value / total) * C;
                const el = (
                  <path
                    key={s.label}
                    d="M20,100 A80,80 0 0 1 180,100"
                    fill="none"
                    stroke={s.color}
                    strokeWidth="18"
                    strokeDasharray={`${Math.max(len - 3, 0)} ${C}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += len;
                return el;
              })
            : null}
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <p className="num !text-center text-2xl font-semibold text-ink">{center ?? total.toLocaleString("th-TH")}</p>
          <p className="text-xs text-muted">{centerLabel}</p>
        </div>
      </div>
      {legend ? (
      <ul className="mt-4 grid gap-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted">
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="num font-medium text-ink">{s.value.toLocaleString("th-TH")}</span>
          </li>
        ))}
      </ul>
      ) : null}
    </div>
  );
}
