"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AnalyticsTimelineRow } from "@/lib/analytics-client";

export type TimelineSeriesKey = "discovered" | "seen" | "submitted";

export type VisibleSeries = Record<TimelineSeriesKey, boolean>;

export const DEFAULT_VISIBLE_SERIES: VisibleSeries = {
  discovered: true,
  seen: true,
  submitted: true,
};

const SERIES: {
  key: TimelineSeriesKey;
  label: string;
  color: string;
  fill: string;
  activeRing: string;
}[] = [
  {
    key: "discovered",
    label: "Discovered",
    color: "#818cf8",
    fill: "url(#gradDiscovered)",
    activeRing: "ring-indigo-400/50",
  },
  {
    key: "seen",
    label: "Seen",
    color: "#a1a1aa",
    fill: "url(#gradSeen)",
    activeRing: "ring-zinc-400/40",
  },
  {
    key: "submitted",
    label: "Submitted",
    color: "#34d399",
    fill: "url(#gradSubmitted)",
    activeRing: "ring-emerald-400/50",
  },
];

type TooltipState = {
  x: number;
  y: number;
  periodLabel: string;
  rows: { label: string; value: number; color: string }[];
};

type Props = {
  data: AnalyticsTimelineRow[];
  height?: number;
  visibleSeries?: VisibleSeries;
};

export function AnalyticsTimelineChart({
  data,
  height = 240,
  visibleSeries = DEFAULT_VISIBLE_SERIES,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const activeSeries = SERIES.filter((s) => visibleSeries[s.key]);
  const chartRows = data;

  const showDayTooltip = useCallback(
    (event: React.MouseEvent, row: AnalyticsTimelineRow) => {
      setTooltip({
        x: event.clientX,
        y: event.clientY,
        periodLabel: row.label,
        rows: activeSeries.map((series) => ({
          label: series.label,
          value: row[series.key],
          color: series.color,
        })),
      });
    },
    [activeSeries],
  );

  const moveTooltip = useCallback((event: React.MouseEvent) => {
    setTooltip((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        x: event.clientX,
        y: event.clientY,
      };
    });
  }, []);

  const hideTooltip = useCallback(() => setTooltip(null), []);

  if (chartRows.length === 0 || activeSeries.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-zinc-500">
        {activeSeries.length === 0
          ? "Select at least one series to display."
          : "No activity in this period yet."}
      </div>
    );
  }

  const viewW = 960;
  const pad = { top: 20, right: 16, bottom: 36, left: 40 };
  const innerW = viewW - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const groupW = innerW / chartRows.length;
  const barW = Math.min(22, Math.max(10, (groupW * 0.72) / activeSeries.length));

  const maxVal = Math.max(
    ...chartRows.map((row) =>
      Math.max(...activeSeries.map((s) => row[s.key]), 0),
    ),
    1,
  );

  const yScale = (v: number) => pad.top + innerH - (v / maxVal) * innerH;
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const showSubmittedLine = visibleSeries.submitted;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b from-indigo-500/[0.06] via-black/20 to-black/40 p-1"
      onMouseLeave={hideTooltip}
    >
      <svg
        viewBox={`0 0 ${viewW} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Project activity timeline"
      >
        <defs>
          <linearGradient id="gradDiscovered" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(129,140,248,0.95)" />
            <stop offset="100%" stopColor="rgba(99,102,241,0.35)" />
          </linearGradient>
          <linearGradient id="gradSeen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(161,161,170,0.85)" />
            <stop offset="100%" stopColor="rgba(113,113,122,0.25)" />
          </linearGradient>
          <linearGradient id="gradSubmitted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(110,231,183,0.95)" />
            <stop offset="100%" stopColor="rgba(52,211,153,0.35)" />
          </linearGradient>
          <filter id="glowSubmitted" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {yTicks.map((tick) => {
          const y = pad.top + innerH * (1 - tick);
          const val = Math.round(maxVal * tick);
          return (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={viewW - pad.right}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray={tick === 0 ? undefined : "4 4"}
              />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#71717a" fontSize="11">
                {val}
              </text>
            </g>
          );
        })}

        {chartRows.map((row, i) => {
          const cx = pad.left + i * groupW + groupW / 2;
          const totalBarW = activeSeries.length * barW + (activeSeries.length - 1) * 3;
          const columnX = pad.left + i * groupW;
          const isHovered = tooltip?.periodLabel === row.label;
          return (
            <g key={row.period}>
              <rect
                x={columnX}
                y={pad.top}
                width={groupW}
                height={innerH}
                fill={isHovered ? "rgba(255,255,255,0.04)" : "transparent"}
                className="cursor-pointer"
                onMouseEnter={(e) => showDayTooltip(e, row)}
                onMouseMove={moveTooltip}
              />
              {activeSeries.map((series, si) => {
                const value = row[series.key];
                const barH = value > 0 ? (value / maxVal) * innerH : 0;
                const x = cx - totalBarW / 2 + si * (barW + 3);
                const y = pad.top + innerH - barH;
                return (
                  <g key={series.key} className="pointer-events-none">
                    {value > 0 ? (
                      <rect
                        x={x}
                        y={y}
                        width={barW}
                        height={Math.max(barH, 3)}
                        rx={4}
                        fill={series.fill}
                        stroke={series.color}
                        strokeWidth={0.75}
                        opacity={isHovered ? 1 : 0.92}
                      />
                    ) : (
                      <circle
                        cx={x + barW / 2}
                        cy={pad.top + innerH - 3}
                        r={2}
                        fill={series.color}
                        opacity={isHovered ? 0.55 : 0.28}
                      />
                    )}
                  </g>
                );
              })}
              <text x={cx} y={height - 12} textAnchor="middle" fill="#a1a1aa" fontSize="11">
                {row.label}
              </text>
            </g>
          );
        })}

        {showSubmittedLine && chartRows.some((r) => r.submitted > 0) && (
          <>
            <path
              d={chartRows
                .map((row, i) => {
                  const si = activeSeries.findIndex((s) => s.key === "submitted");
                  const cx = pad.left + i * groupW + groupW / 2;
                  const totalBarW = activeSeries.length * barW + (activeSeries.length - 1) * 3;
                  const x =
                    si >= 0
                      ? cx - totalBarW / 2 + si * (barW + 3) + barW / 2
                      : cx;
                  const y = yScale(row.submitted);
                  return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                })
                .join(" ")}
              fill="none"
              stroke="#6ee7b7"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#glowSubmitted)"
              className="pointer-events-none"
            />
            {chartRows.map((row, i) => {
              if (row.submitted <= 0) return null;
              const si = activeSeries.findIndex((s) => s.key === "submitted");
              if (si < 0) return null;
              const cx = pad.left + i * groupW + groupW / 2;
              const totalBarW = activeSeries.length * barW + (activeSeries.length - 1) * 3;
              const x = cx - totalBarW / 2 + si * (barW + 3) + barW / 2;
              const y = yScale(row.submitted);
              return (
                <circle
                  key={row.period}
                  cx={x}
                  cy={y}
                  r={3.5}
                  fill="#6ee7b7"
                  stroke="#052e16"
                  strokeWidth="1"
                  className="pointer-events-none"
                />
              );
            })}
          </>
        )}
      </svg>

      {tooltip &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999] min-w-[10rem] rounded-lg border border-white/12 bg-zinc-900/50 px-3 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-md"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: "translate(-50%, calc(-100% - 10px))",
            }}
          >
            <p className="text-[11px] font-medium text-zinc-400">{tooltip.periodLabel}</p>
            <ul className="mt-2 space-y-1.5">
              {tooltip.rows.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-4 text-xs">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <span
                      className="inline-block h-2 w-2 rounded-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </span>
                  <span
                    className={`font-semibold tabular-nums ${
                      item.value === 0 ? "text-zinc-500" : "text-zinc-50"
                    }`}
                  >
                    {item.value.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}

export function AnalyticsChartLegend({
  visibleSeries,
  onToggle,
}: {
  visibleSeries: VisibleSeries;
  onToggle: (key: TimelineSeriesKey) => void;
}) {
  const activeCount = SERIES.filter((s) => visibleSeries[s.key]).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {SERIES.map((s) => {
        const active = visibleSeries[s.key];
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onToggle(s.key)}
            disabled={active && activeCount <= 1}
            title={active ? `Hide ${s.label}` : `Show ${s.label}`}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ring-1 transition ${
              active
                ? `bg-white/[0.06] text-zinc-200 ${s.activeRing}`
                : "bg-transparent text-zinc-600 ring-white/[0.06] line-through opacity-50 hover:opacity-70"
            } disabled:cursor-not-allowed`}
            aria-pressed={active}
          >
            <span
              className="h-2.5 w-2.5 rounded-[3px] ring-1 ring-white/10"
              style={{ background: active ? s.color : "#52525b" }}
            />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
