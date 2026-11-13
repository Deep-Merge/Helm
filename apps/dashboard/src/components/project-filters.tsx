"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { FilterCheckboxRow } from "@/components/filter-checkbox";
import { FilterBudgetRange } from "@/components/filter-budget-range";
import { FilterCountriesChecklist } from "@/components/filter-countries-checklist";
import { FilterSkillsChecklist } from "@/components/filter-skills-checklist";
import { FilterSidebarSection } from "@/components/filter-sidebar-section";
import {
  clearLastFindPreset,
  readLastFindPreset,
  writeLastFindPreset,
} from "@/lib/find-last-preset";
import type { ProjectFilterValues, SavedFilter } from "@/lib/project-filters";
import {
  deriveBudgetType,
  EMPTY_FILTER_VALUES,
  parseCsvList,
  parseFindStatus,
  savedToValues,
  toCsvList,
  toSearchParams,
} from "@/lib/project-filters";

export type { ProjectFilterValues, SavedFilter };

type SkillOption = { skill: string; count: number };

let cachedSkillOptions: SkillOption[] | null = null;

function ProjectTypeCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <FilterCheckboxRow checked={checked} onToggle={() => onChange(!checked)}>
      {label}
    </FilterCheckboxRow>
  );
}

function normalizeBudget(value: string) {
  return value === "0" ? "" : value;
}

function filtersEqual(a: ProjectFilterValues, b: ProjectFilterValues): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function ProjectFilters({
  initial,
  comfortable = false,
  layout = "bar",
  onCollapse,
  collapseToggle,
}: {
  initial: ProjectFilterValues;
  comfortable?: boolean;
  layout?: "bar" | "sidebar";
  onCollapse?: () => void;
  collapseToggle?: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listStatus = parseFindStatus(
    Object.fromEntries(searchParams.entries()) as Record<string, string | undefined>,
  );
  const [appliedValues, setAppliedValues] = useState(initial);
  const [saved, setSaved] = useState<SavedFilter[]>([]);
  const [presetName, setPresetName] = useState("");
  const [saving, setSaving] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [skillOptions, setSkillOptions] = useState<SkillOption[]>(cachedSkillOptions ?? []);
  const [skillsLoading, setSkillsLoading] = useState(cachedSkillOptions == null);

  useEffect(() => {
    setAppliedValues(initial);
  }, [initial]);

  useEffect(() => {
    setActivePresetId(readLastFindPreset()?.presetId ?? null);
  }, []);

  useEffect(() => {
    fetch("/api/filters")
      .then((r) => r.json())
      .then((data) => setSaved(data.filters || []))
      .catch(() => setSaved([]));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSkills(silent = false) {
      if (!silent && cachedSkillOptions == null) setSkillsLoading(true);
      try {
        const res = await fetch("/api/projects/skills", { cache: "no-store" });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = (await res.json()) as { skills?: SkillOption[] };
        const next = data.skills || [];
        cachedSkillOptions = next;
        if (!cancelled) setSkillOptions(next);
      } catch {
        if (!cancelled && cachedSkillOptions == null) setSkillOptions([]);
      } finally {
        if (!cancelled) setSkillsLoading(false);
      }
    }

    void loadSkills();

    function onProjectsUpdated() {
      void loadSkills(true);
    }

    window.addEventListener("bidautomation:projects-updated", onProjectsUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("bidautomation:projects-updated", onProjectsUpdated);
    };
  }, []);

  const apply = useCallback(
    (next: ProjectFilterValues, options?: { presetId?: string | null }) => {
      const withBudgetType = {
        ...next,
        budget_type: deriveBudgetType(next.type_fixed, next.type_hourly),
      };
      setAppliedValues(withBudgetType);

      const presetId = options?.presetId ?? null;
      setActivePresetId(presetId);

      if (filtersEqual(withBudgetType, EMPTY_FILTER_VALUES)) {
        clearLastFindPreset();
      } else {
        writeLastFindPreset({
          presetId: presetId ?? undefined,
          values: withBudgetType,
          status: listStatus,
        });
      }

      const qs = toSearchParams(withBudgetType, false, 1, listStatus).toString();
      const path = qs ? `/find?${qs}` : "/find";
      router.replace(path, { scroll: false });
    },
    [router, listStatus],
  );

  async function savePreset(draft: ProjectFilterValues) {
    if (!presetName.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: presetName.trim(),
        q: draft.q || null,
        countries: parseCsvList(draft.exclude_countries),
        skills: parseCsvList(draft.skills),
        min_budget: draft.min_budget ? Number(draft.min_budget) : null,
        max_budget: draft.max_budget ? Number(draft.max_budget) : null,
        min_hourly: draft.min_hourly ? Number(draft.min_hourly) : null,
        max_hourly: draft.max_hourly ? Number(draft.max_hourly) : null,
        budget_type: deriveBudgetType(draft.type_fixed, draft.type_hourly) || "any",
        days: draft.days ? Number(draft.days) : null,
      };
      const res = await fetch("/api/filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.filter) {
        setSaved((prev) => [data.filter, ...prev]);
        setPresetName("");
        loadPreset(data.filter);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deletePreset(id: string) {
    await fetch(`/api/filters?id=${id}`, { method: "DELETE" });
    setSaved((prev) => prev.filter((f) => f.id !== id));
    if (activePresetId === id) setActivePresetId(null);
  }

  function loadPreset(filter: SavedFilter) {
    apply(savedToValues(filter), { presetId: filter.id });
  }

  const textSm = comfortable ? "text-base" : "text-sm";

  const sidebar = (
    <ProjectFiltersSidebar
      appliedValues={appliedValues}
      apply={apply}
      saved={saved}
      presetName={presetName}
      setPresetName={setPresetName}
      saving={saving}
      savePreset={savePreset}
      deletePreset={deletePreset}
      loadPreset={loadPreset}
      activePresetId={activePresetId}
      skillOptions={skillOptions}
      skillsLoading={skillsLoading}
      textSm={textSm}
      onCollapse={onCollapse}
      collapseToggle={collapseToggle}
    />
  );

  if (layout !== "sidebar") {
    return <div className="mb-6">{sidebar}</div>;
  }

  return sidebar;
}

function ProjectFiltersSidebar({
  appliedValues,
  apply,
  saved,
  presetName,
  setPresetName,
  saving,
  savePreset,
  deletePreset,
  loadPreset,
  activePresetId,
  skillOptions,
  skillsLoading,
  textSm,
  onCollapse,
  collapseToggle,
}: {
  appliedValues: ProjectFilterValues;
  apply: (next: ProjectFilterValues, options?: { presetId?: string | null }) => void;
  saved: SavedFilter[];
  presetName: string;
  setPresetName: (value: string) => void;
  saving: boolean;
  savePreset: (draft: ProjectFilterValues) => void;
  deletePreset: (id: string) => void;
  loadPreset: (filter: SavedFilter) => void;
  activePresetId: string | null;
  skillOptions: { skill: string; count: number }[];
  skillsLoading: boolean;
  textSm: string;
  onCollapse?: () => void;
  collapseToggle?: ReactNode;
}) {
  const [draftValues, setDraftValues] = useState(appliedValues);
  const [budgetDraft, setBudgetDraft] = useState({
    min_budget: appliedValues.min_budget,
    max_budget: appliedValues.max_budget,
    min_hourly: appliedValues.min_hourly,
    max_hourly: appliedValues.max_hourly,
  });

  useEffect(() => {
    setDraftValues(appliedValues);
    setBudgetDraft({
      min_budget: appliedValues.min_budget,
      max_budget: appliedValues.max_budget,
      min_hourly: appliedValues.min_hourly,
      max_hourly: appliedValues.max_hourly,
    });
  }, [appliedValues]);

  function patchDraft(partial: Partial<ProjectFilterValues>) {
    setDraftValues((current) => ({ ...current, ...partial }));
  }

  function buildSubmitValues(): ProjectFilterValues {
    return {
      ...draftValues,
      min_budget: normalizeBudget(budgetDraft.min_budget),
      max_budget: normalizeBudget(budgetDraft.max_budget),
      min_hourly: normalizeBudget(budgetDraft.min_hourly),
      max_hourly: normalizeBudget(budgetDraft.max_hourly),
    };
  }

  function submitFilters() {
    apply(buildSubmitValues());
  }

  const selectedSkills = parseCsvList(draftValues.skills);
  const selectedCountries = parseCsvList(draftValues.exclude_countries);
  const submitValues = buildSubmitValues();

  return (
    <div className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-2xl">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
        <h2 className="text-base font-semibold text-zinc-100">Filters</h2>
        {collapseToggle ??
          (onCollapse ? (
            <button
              type="button"
              onClick={onCollapse}
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-zinc-500 ring-1 ring-white/10 transition hover:bg-white/5 hover:text-zinc-200"
              aria-label="Collapse filters"
              title="Collapse filters"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path d="M11 5 6 10l5 5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 5v10" strokeLinecap="round" />
              </svg>
            </button>
          ) : null)}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 [overflow-anchor:none]">
      <FilterSidebarSection
        title="Presets"
        sectionId="presets"
        defaultOpen={saved.length > 0}
      >
        {saved.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {saved.map((f) => (
                <div
                  key={f.id}
                  className={`flex items-center gap-1 rounded-full pl-3 pr-1 ring-1 ${
                    activePresetId === f.id
                      ? "bg-indigo-500/20 ring-indigo-400/50"
                      : "bg-indigo-500/10 ring-indigo-500/25"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => loadPreset(f)}
                    className="py-1.5 text-xs font-medium text-indigo-200 hover:text-white"
                  >
                    {f.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePreset(f.id)}
                    className="rounded-full px-2 py-1 text-xs text-zinc-500 hover:text-red-300"
                    aria-label={`Delete ${f.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">No saved presets — apply filters, then save below.</p>
          )}
      </FilterSidebarSection>

      <FilterSidebarSection
          title="Project type"
          sectionId="project-type"
          onClear={() => patchDraft({ type_fixed: false, type_hourly: false })}
        >
          <div className="space-y-1">
            <ProjectTypeCheckbox
              label="Hourly Rate"
              checked={draftValues.type_hourly}
              onChange={(type_hourly) => patchDraft({ type_hourly })}
            />
            <ProjectTypeCheckbox
              label="Fixed Price"
              checked={draftValues.type_fixed}
              onChange={(type_fixed) => patchDraft({ type_fixed })}
            />
          </div>
        </FilterSidebarSection>

        <FilterSidebarSection
          title="Fixed price"
          sectionId="fixed-price"
          onClear={() => {
            patchDraft({ min_budget: "", max_budget: "" });
            setBudgetDraft((d) => ({ ...d, min_budget: "", max_budget: "" }));
          }}
        >
          <FilterBudgetRange
            min={budgetDraft.min_budget}
            max={budgetDraft.max_budget}
            onMinChange={(min_budget) => setBudgetDraft((d) => ({ ...d, min_budget }))}
            onMaxChange={(max_budget) => setBudgetDraft((d) => ({ ...d, max_budget }))}
            onCommit={() =>
              patchDraft({
                min_budget: normalizeBudget(budgetDraft.min_budget),
                max_budget: normalizeBudget(budgetDraft.max_budget),
              })
            }
            maxPlaceholder="1500+"
          />
        </FilterSidebarSection>

        <FilterSidebarSection
          title="Hourly rate"
          sectionId="hourly-rate"
          onClear={() => {
            patchDraft({ min_hourly: "", max_hourly: "" });
            setBudgetDraft((d) => ({ ...d, min_hourly: "", max_hourly: "" }));
          }}
        >
          <FilterBudgetRange
            min={budgetDraft.min_hourly}
            max={budgetDraft.max_hourly}
            onMinChange={(min_hourly) => setBudgetDraft((d) => ({ ...d, min_hourly }))}
            onMaxChange={(max_hourly) => setBudgetDraft((d) => ({ ...d, max_hourly }))}
            onCommit={() =>
              patchDraft({
                min_hourly: normalizeBudget(budgetDraft.min_hourly),
                max_hourly: normalizeBudget(budgetDraft.max_hourly),
              })
            }
            maxPlaceholder="80+"
          />
        </FilterSidebarSection>

        <FilterSidebarSection
          title="Skills"
          sectionId="skills"
          className="overflow-visible"
          onClear={() => patchDraft({ skills: "" })}
        >
          <FilterSkillsChecklist
            options={skillOptions}
            selected={selectedSkills}
            onChange={(skills) => patchDraft({ skills: toCsvList(skills) })}
            placeholder="Search skills"
            loading={skillsLoading}
          />
        </FilterSidebarSection>

        <FilterSidebarSection
          title="Exclude countries"
          sectionId="exclude-countries"
          onClear={() => patchDraft({ exclude_countries: "" })}
        >
          <p className="mb-2 text-xs text-zinc-500">Hide projects from these client countries</p>
          <FilterCountriesChecklist
            selected={selectedCountries}
            onChange={(countries) => patchDraft({ exclude_countries: toCsvList(countries) })}
            placeholder="Search countries to exclude"
          />
        </FilterSidebarSection>

        <div className="space-y-2 border-t border-white/[0.08] py-4">
          <button
            type="button"
            onClick={submitFilters}
            className={`w-full rounded-xl bg-indigo-500 px-5 py-2.5 font-medium text-white ${textSm}`}
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={() => apply(EMPTY_FILTER_VALUES, { presetId: null })}
            className={`w-full rounded-xl px-4 py-2.5 text-zinc-400 hover:text-zinc-200 ${textSm}`}
          >
            Clear all
          </button>
          <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-4">
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name…"
              className={`rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-zinc-200 outline-none transition placeholder:text-zinc-500 hover:border-white/15 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 ${textSm}`}
            />
            <button
              type="button"
              disabled={saving || !presetName.trim()}
              onClick={() => savePreset(submitValues)}
              className={`rounded-xl bg-white/5 px-4 py-2.5 text-zinc-300 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40 ${textSm}`}
            >
              Save preset
            </button>
          </div>
        </div>
      </div>
      </div>
  );
}
