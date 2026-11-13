"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FilterCheckboxRow,
  FilterScrollList,
  FilterSearchField,
  FilterSelectedPill,
} from "@/components/filter-checkbox";

export interface ProjectSkillOption {
  skill: string;
  count: number;
}

let cachedSkillOptions: ProjectSkillOption[] | null = null;

function sortSkillsAlphabetically(options: ProjectSkillOption[]): ProjectSkillOption[] {
  return [...options].sort((a, b) =>
    a.skill.localeCompare(b.skill, undefined, { sensitivity: "base" }),
  );
}

export function FilterSkillsChecklist({
  options,
  selected,
  onChange,
  placeholder = "Search skills",
  listMaxHeightClass = "max-h-64",
  loading = false,
}: {
  options: ProjectSkillOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  listMaxHeightClass?: string;
  loading?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [fetchedOptions, setFetchedOptions] = useState<ProjectSkillOption[]>(
    cachedSkillOptions ?? [],
  );
  const [fetching, setFetching] = useState(cachedSkillOptions == null && options.length === 0);

  useEffect(() => {
    if (options.length > 0) {
      cachedSkillOptions = options;
      setFetchedOptions(options);
      setFetching(false);
      return;
    }
    if (cachedSkillOptions) {
      setFetchedOptions(cachedSkillOptions);
      setFetching(false);
    }

    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/projects/skills", { cache: "no-store" });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = (await res.json()) as { skills?: ProjectSkillOption[] };
        const next = data.skills || [];
        cachedSkillOptions = next;
        if (!cancelled) setFetchedOptions(next);
      } catch {
        if (!cancelled && !cachedSkillOptions) setFetchedOptions([]);
      } finally {
        if (!cancelled) setFetching(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [options.length]);

  const resolvedOptions = options.length > 0 ? options : fetchedOptions;
  const showLoading = loading || fetching;
  const selectedSet = useMemo(() => new Set(selected.map((s) => s.toLowerCase())), [selected]);
  const optionByKey = useMemo(() => {
    const map = new Map<string, ProjectSkillOption>();
    for (const option of resolvedOptions) {
      map.set(option.skill.toLowerCase(), option);
    }
    return map;
  }, [resolvedOptions]);

  const sortedOptions = useMemo(
    () => sortSkillsAlphabetically(resolvedOptions),
    [resolvedOptions],
  );
  const trimmedQuery = query.trim().toLowerCase();

  const visible = useMemo(() => {
    if (!trimmedQuery) return sortedOptions;
    return sortedOptions.filter((option) => option.skill.toLowerCase().includes(trimmedQuery));
  }, [sortedOptions, trimmedQuery]);

  function remove(skill: string) {
    const key = skill.toLowerCase();
    onChange(selected.filter((item) => item.toLowerCase() !== key));
  }

  function toggle(skill: string) {
    const key = skill.toLowerCase();
    if (selectedSet.has(key)) {
      onChange(selected.filter((item) => item.toLowerCase() !== key));
      return;
    }
    onChange([...selected, skill]);
  }

  const sortedSelected = useMemo(() => {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const skill of selected) {
      const key = skill.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(skill);
    }
    return sortSkillsAlphabetically(
      unique.map((skill) => ({
        skill,
        count: optionByKey.get(skill.toLowerCase())?.count ?? 0,
      })),
    );
  }, [selected, optionByKey]);

  return (
    <div className="space-y-2.5 [overflow-anchor:none]">
      {selected.length > 0 && (
        <div className="max-h-28 overflow-y-auto overscroll-contain [overflow-anchor:none] pr-1">
          <div className="flex flex-wrap gap-1.5">
            {sortedSelected.map((option) => (
              <FilterSelectedPill key={option.skill} onRemove={() => remove(option.skill)}>
                {option.skill}
              </FilterSelectedPill>
            ))}
          </div>
        </div>
      )}

      <FilterSearchField value={query} onChange={setQuery} placeholder={placeholder} />

      {showLoading && resolvedOptions.length === 0 && (
        <p className="px-1 text-xs text-zinc-500">Loading skills from your projects…</p>
      )}

      {!showLoading && resolvedOptions.length === 0 && (
        <p className="px-1 text-xs text-zinc-500">
          No skills yet. Discover projects to build the skills list.
        </p>
      )}

      {resolvedOptions.length > 0 && (
        <FilterScrollList maxHeightClass={listMaxHeightClass}>
          {visible.map((option) => {
            const checked = selectedSet.has(option.skill.toLowerCase());
            return (
              <li key={option.skill}>
                <FilterCheckboxRow
                  checked={checked}
                  onToggle={() => toggle(option.skill)}
                  trailing={
                    <span className="shrink-0 tabular-nums text-xs text-zinc-600">
                      {option.count}
                    </span>
                  }
                >
                  {option.skill}
                </FilterCheckboxRow>
              </li>
            );
          })}
          {visible.length === 0 && (
            <li className="px-2 py-2.5 text-xs text-zinc-500">
              No matching skills in your projects
            </li>
          )}
        </FilterScrollList>
      )}

      {!loading &&
        selected.some((skill) => !optionByKey.has(skill.toLowerCase())) && (
          <p className="px-1 text-xs text-zinc-500">
            Some selected skills are not in your current project list.
          </p>
        )}
    </div>
  );
}
