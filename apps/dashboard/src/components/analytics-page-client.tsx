"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout";
import {
  AnalyticsChartLegend,
  AnalyticsTimelineChart,
  DEFAULT_VISIBLE_SERIES,
  type TimelineSeriesKey,
  type VisibleSeries,
} from "@/components/analytics-timeline-chart";
import type { AnalyticsPreset, AnalyticsReport } from "@/lib/analytics-client";
import {
  getAnalyticsReportClient,
  readAnalyticsPresetId,
  writeAnalyticsPresetId,
} from "@/lib/analytics-client";

type Granularity = "day" | "week" | "month";

const RANGE_OPTIONS = [
  { days: 7, label: "7d", defaultGranularity: "day" as Granularity },
  { days: 30, label: "30d", defaultGranularity: "day" as Granularity },
  { days: 90, label: "90d", defaultGranularity: "week" as Granularity },
  { days: 365, label: "12mo", defaultGranularity: "month" as Granularity },
];

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

function TogglePills<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
              active
                ? "bg-indigo-500/25 text-indigo-200 ring-1 ring-indigo-500/40"
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            }`}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass rounded-xl p-3 ${className}`}>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{title}</h2>
      {subtitle && <p className="mb-2 mt-0.5 text-[10px] text-zinc-600">{subtitle}</p>}
      {!subtitle && <div className="mb-2" />}
      {children}
    </div>
  );
}

function MetricCell({
  label,
  value,
  sub,
  accent = "zinc",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "indigo" | "zinc" | "emerald" | "violet" | "sky";
}) {
  const valueColor = {
    indigo: "text-indigo-200",
    zinc: "text-zinc-200",
    emerald: "text-emerald-200",
    violet: "text-violet-200",
    sky: "text-sky-200",
  }[accent];

  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] font-medium uppercase tracking-wider text-zinc-600">
        {label}
      </p>
      <p className={`text-lg font-bold tabular-nums leading-tight ${valueColor}`}>{value}</p>
      {sub && <p className="truncate text-[10px] text-zinc-600">{sub}</p>}
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  colorClass = "bg-indigo-500/70",
}: {
  label: string;
  value: number;
  max: number;
  colorClass?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 truncate text-zinc-400" title={label}>
        {label}
      </span>
      <div className="h-1.5 min-w-0 flex-1 rounded-full bg-white/[0.05]">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right tabular-nums text-zinc-500">{value}</span>
    </div>
  );
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return "—";
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatRating(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toFixed(1);
}

export function AnalyticsPageClient({
  initialReport,
  presets,
}: {
  initialReport: AnalyticsReport;
  presets: AnalyticsPreset[];
}) {
  const [report, setReport] = useState(initialReport);
  const [days, setDays] = useState(initialReport.days);
  const [granularity, setGranularity] = useState<Granularity>(initialReport.granularity);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [prefsReady, setPrefsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visibleSeries, setVisibleSeries] = useState<VisibleSeries>(DEFAULT_VISIBLE_SERIES);
  const hydratedRef = useRef(false);

  useLayoutEffect(() => {
    setPresetId(readAnalyticsPresetId());
    setPrefsReady(true);
  }, []);

  const loadReport = useCallback(
    async (nextDays: number, nextGranularity: Granularity, nextPresetId: string | null) => {
      setLoading(true);
      try {
        const result = await getAnalyticsReportClient({
          days: nextDays,
          granularity: nextGranularity,
          presetId: nextPresetId,
        });
        setReport(result);
      } catch {
        /* keep previous */
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!prefsReady) return;
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      if (
        !presetId &&
        days === initialReport.days &&
        granularity === initialReport.granularity
      ) {
        return;
      }
    }
    void loadReport(days, granularity, presetId);
  }, [days, granularity, presetId, prefsReady, loadReport, initialReport.days, initialReport.granularity]);

  function handleRangeChange(nextDays: number) {
    const preset = RANGE_OPTIONS.find((r) => r.days === nextDays);
    setDays(nextDays);
    if (preset) setGranularity(preset.defaultGranularity);
  }

  function handlePresetChange(id: string | null) {
    setPresetId(writeAnalyticsPresetId(id));
  }

  function toggleSeries(key: TimelineSeriesKey) {
    setVisibleSeries((prev) => {
      const active = (Object.keys(prev) as TimelineSeriesKey[]).filter((k) => prev[k]).length;
      if (prev[key] && active <= 1) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  }

  const { pipeline, insights, period_totals: periodTotals, submitted_analysis: submitted } =
    report;
  const maxSkill = report.skills[0]?.count || 1;
  const maxCountry = report.countries[0]?.count || 1;
  const maxSubmittedSkill = submitted.skills[0]?.count || 1;
  const maxSubmittedCountry = submitted.countries[0]?.count || 1;
  const maxPeriodSkill = submitted.period_skills[0]?.count || 1;
  const maxPeriodCountry = submitted.period_countries[0]?.count || 1;
  const budgetTotal =
    report.budget_types.fixed + report.budget_types.hourly + report.budget_types.unknown;
  const submittedBudgetTotal =
    submitted.budget_types.fixed + submitted.budget_types.hourly + submitted.budget_types.unknown;

  const activePresetName =
    report.preset?.name ??
    (presetId ? presets.find((p) => p.id === presetId)?.name : null);

  return (
    <div className="w-full space-y-3">
      <PageHeader
        title="Analytics"
        description={
          activePresetName
            ? `Filtered by preset “${activePresetName}”`
            : "All projects — or pick a saved preset from Find."
        }
        className="!mb-0"
        titleClassName="text-xl"
      />

      {/* Preset tags */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
          Preset
        </span>
        <button
          type="button"
          onClick={() => handlePresetChange(null)}
          className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ${
            !presetId
              ? "bg-indigo-500/20 text-indigo-200 ring-indigo-500/40"
              : "bg-white/[0.03] text-zinc-500 ring-white/10 hover:text-zinc-300"
          }`}
        >
          All projects
        </button>
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handlePresetChange(p.id)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ${
              presetId === p.id
                ? "bg-indigo-500/20 text-indigo-200 ring-indigo-500/40"
                : "bg-white/[0.03] text-zinc-500 ring-white/10 hover:text-zinc-300"
            }`}
          >
            {p.name}
          </button>
        ))}
        {presets.length === 0 && (
          <span className="text-xs text-zinc-600">Save presets on Find to filter here</span>
        )}
      </div>

      {/* KPI grid */}
      <div className={`glass rounded-xl p-3 ${loading ? "opacity-60" : ""}`}>
        <div className="grid grid-cols-3 gap-x-3 gap-y-3 sm:grid-cols-4 lg:grid-cols-7">
          <MetricCell label="Discovered" value={pipeline.discovered.toLocaleString()} accent="indigo" />
          <MetricCell label="Seen" value={pipeline.seen.toLocaleString()} sub={`${pipeline.new} new`} accent="zinc" />
          <MetricCell
            label="Submitted"
            value={pipeline.submitted.toLocaleString()}
            sub={`${insights.overall_submit_pct}% overall`}
            accent="emerald"
          />
          <MetricCell label="Pipeline" value={pipeline.new.toLocaleString()} sub="not seen" accent="violet" />
          <MetricCell label="Period disc." value={periodTotals.discovered.toLocaleString()} accent="sky" />
          <MetricCell label="Period seen" value={periodTotals.seen.toLocaleString()} accent="zinc" />
          <MetricCell label="Period sub." value={periodTotals.submitted.toLocaleString()} accent="emerald" />
        </div>
      </div>

      {/* Chart + conversion */}
      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        <div className={`glass rounded-xl p-4 ${loading ? "opacity-60" : ""}`}>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Activity timeline
              </h2>
              <div className="mt-1.5">
                <AnalyticsChartLegend visibleSeries={visibleSeries} onToggle={toggleSeries} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TogglePills
                value={String(days)}
                options={RANGE_OPTIONS.map((r) => ({ value: String(r.days), label: r.label }))}
                onChange={(v) => handleRangeChange(Number(v))}
              />
              <TogglePills
                value={granularity}
                options={GRANULARITY_OPTIONS}
                onChange={setGranularity}
              />
            </div>
          </div>

          <AnalyticsTimelineChart
            data={report.timeline}
            visibleSeries={visibleSeries}
            height={280}
          />

          <div className="mt-3 flex flex-wrap gap-4 border-t border-white/[0.06] pt-3 text-xs">
            <span className="text-zinc-500">
              Period discovered{" "}
              <span className="font-semibold tabular-nums text-indigo-300">
                {periodTotals.discovered.toLocaleString()}
              </span>
            </span>
            <span className="text-zinc-500">
              Seen{" "}
              <span className="font-semibold tabular-nums text-zinc-300">
                {periodTotals.seen.toLocaleString()}
              </span>
            </span>
            <span className="text-zinc-500">
              Submitted{" "}
              <span className="font-semibold tabular-nums text-emerald-300">
                {periodTotals.submitted.toLocaleString()}
              </span>
            </span>
            {loading && <span className="text-zinc-600">Updating…</span>}
          </div>
        </div>

        <Panel title="Conversion" subtitle="All-time rates">
          <div className="space-y-3">
            <MetricCell
              label="View rate"
              value={`${insights.view_rate_pct}%`}
              sub="seen ÷ discovered"
              accent="zinc"
            />
            <MetricCell
              label="Submit rate"
              value={`${insights.submit_rate_pct}%`}
              sub="submitted ÷ seen"
              accent="emerald"
            />
            {insights.avg_submitted_bid != null && (
              <MetricCell
                label="Avg bid"
                value={`$${insights.avg_submitted_bid.toLocaleString()}`}
                sub={`${insights.submitted_with_bid} bids`}
                accent="emerald"
              />
            )}
          </div>
        </Panel>
      </div>

      {/* Detail panels */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Panel title="Pipeline">
          <div className="space-y-2">
            <BarRow label="Discovered" value={pipeline.discovered} max={pipeline.discovered} />
            <BarRow label="Seen" value={pipeline.seen} max={pipeline.discovered} colorClass="bg-zinc-400/60" />
            <BarRow label="Submitted" value={pipeline.submitted} max={pipeline.discovered} colorClass="bg-emerald-500/70" />
            <BarRow label="New" value={pipeline.new} max={pipeline.discovered} colorClass="bg-indigo-500/70" />
          </div>
        </Panel>

        <Panel title="Budget type">
          <div className="space-y-2">
            <BarRow label="Fixed" value={report.budget_types.fixed} max={budgetTotal} colorClass="bg-sky-500/70" />
            <BarRow label="Hourly" value={report.budget_types.hourly} max={budgetTotal} colorClass="bg-violet-500/70" />
            <BarRow label="Unknown" value={report.budget_types.unknown} max={budgetTotal} colorClass="bg-zinc-500/50" />
          </div>
        </Panel>

        <Panel title="Top countries" className="sm:col-span-2 lg:col-span-1">
          <div className="max-h-[120px] space-y-1.5 overflow-y-auto pr-1">
            {report.countries.length === 0 ? (
              <p className="text-xs text-zinc-600">No country data</p>
            ) : (
              report.countries.map((c) => (
                <BarRow key={c.country} label={c.country} value={c.count} max={maxCountry} colorClass="bg-indigo-500/60" />
              ))
            )}
          </div>
        </Panel>

        <Panel title="Top skills" className="sm:col-span-2 lg:col-span-3">
          <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {report.skills.length === 0 ? (
              <p className="text-xs text-zinc-600">No skill data</p>
            ) : (
              report.skills.map((s) => (
                <BarRow key={s.skill} label={s.skill} value={s.count} max={maxSkill} colorClass="bg-violet-500/65" />
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* Submitted project analysis */}
      <div className={`space-y-3 ${loading ? "opacity-60" : ""}`}>
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Submitted projects</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Breakdown of projects you marked submitted — budgets, stacks, and client countries.
          </p>
        </div>

        <div className="glass rounded-xl p-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCell
              label="Submitted"
              value={submitted.total.toLocaleString()}
              sub={`${submitted.period_total} in period`}
              accent="emerald"
            />
            <MetricCell
              label="Avg budget"
              value={formatMoney(submitted.avg_project_budget)}
              sub={
                submitted.period_avg_project_budget != null
                  ? `${formatMoney(submitted.period_avg_project_budget)} in period`
                  : `${submitted.with_budget} with budget`
              }
              accent="sky"
            />
            <MetricCell
              label="Avg your bid"
              value={formatMoney(submitted.avg_submitted_bid)}
              sub={
                submitted.period_avg_submitted_bid != null
                  ? `${formatMoney(submitted.period_avg_submitted_bid)} in period`
                  : `${submitted.with_bid} recorded`
              }
              accent="emerald"
            />
            <MetricCell
              label="Fixed avg"
              value={formatMoney(submitted.avg_budget_fixed)}
              sub={`${submitted.budget_types.fixed} fixed`}
              accent="sky"
            />
            <MetricCell
              label="Hourly avg"
              value={formatMoney(submitted.avg_budget_hourly)}
              sub={`${submitted.budget_types.hourly} hourly`}
              accent="violet"
            />
            <MetricCell
              label="Client rating"
              value={formatRating(submitted.avg_client_rating)}
              sub={
                submitted.avg_competition_bids != null
                  ? `~${Math.round(submitted.avg_competition_bids)} bids / project`
                  : undefined
              }
              accent="zinc"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Panel title="Submitted budget mix">
            <div className="space-y-2">
              <BarRow
                label="Fixed"
                value={submitted.budget_types.fixed}
                max={submittedBudgetTotal}
                colorClass="bg-sky-500/70"
              />
              <BarRow
                label="Hourly"
                value={submitted.budget_types.hourly}
                max={submittedBudgetTotal}
                colorClass="bg-violet-500/70"
              />
              <BarRow
                label="Unknown"
                value={submitted.budget_types.unknown}
                max={submittedBudgetTotal}
                colorClass="bg-zinc-500/50"
              />
            </div>
          </Panel>

          <Panel title="Submitted countries" subtitle="All-time">
            <div className="max-h-[160px] space-y-1.5 overflow-y-auto pr-1">
              {submitted.countries.length === 0 ? (
                <p className="text-xs text-zinc-600">No submitted projects yet</p>
              ) : (
                submitted.countries.map((c) => (
                  <BarRow
                    key={c.country}
                    label={c.country}
                    value={c.count}
                    max={maxSubmittedCountry}
                    colorClass="bg-emerald-500/65"
                  />
                ))
              )}
            </div>
          </Panel>

          <Panel title="Period countries" subtitle={`Last ${days}d submitted`}>
            <div className="max-h-[160px] space-y-1.5 overflow-y-auto pr-1">
              {submitted.period_countries.length === 0 ? (
                <p className="text-xs text-zinc-600">None in this period</p>
              ) : (
                submitted.period_countries.map((c) => (
                  <BarRow
                    key={c.country}
                    label={c.country}
                    value={c.count}
                    max={maxPeriodCountry}
                    colorClass="bg-emerald-500/50"
                  />
                ))
              )}
            </div>
          </Panel>

          <Panel title="Submitted skills" subtitle="Stacks & tags" className="sm:col-span-2 lg:col-span-2">
            <div className="grid max-h-[180px] gap-x-4 gap-y-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
              {submitted.skills.length === 0 ? (
                <p className="text-xs text-zinc-600">No skill data on submitted projects</p>
              ) : (
                submitted.skills.map((s) => (
                  <BarRow
                    key={s.skill}
                    label={s.skill}
                    value={s.count}
                    max={maxSubmittedSkill}
                    colorClass="bg-violet-500/65"
                  />
                ))
              )}
            </div>
          </Panel>

          <Panel title="Period skills" subtitle={`Last ${days}d submitted`}>
            <div className="max-h-[180px] space-y-1.5 overflow-y-auto pr-1">
              {submitted.period_skills.length === 0 ? (
                <p className="text-xs text-zinc-600">None in this period</p>
              ) : (
                submitted.period_skills.map((s) => (
                  <BarRow
                    key={s.skill}
                    label={s.skill}
                    value={s.count}
                    max={maxPeriodSkill}
                    colorClass="bg-violet-500/50"
                  />
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
