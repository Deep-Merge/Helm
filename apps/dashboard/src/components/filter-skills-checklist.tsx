"use client";

import { useMemo, useState } from "react";
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
  const selectedSet = useMemo(() => new Set(selected.map((s) => s.toLowerCase())), [selected]);
  const optionByKey = useMemo(() => {
    const map = new Map<string, ProjectSkillOption>();
    for (const option of options) {
      map.set(option.skill.toLowerCase(), option);
    }
    return map;
  }, [options]);

  const sortedOptions = useMemo(() => sortSkillsAlphabetically(options), [options]);
  const trimmedQuery = query.trim();
  const showSearchResults = trimmedQuery.length > 0;

  const filtered = useMemo(() => {
    if (!showSearchResults) return [];
    const q = trimmedQuery.toLowerCase();
    return sortedOptions.filter((option) => option.skill.toLowerCase().includes(q));
  }, [sortedOptions, trimmedQuery, showSearchResults]);

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
    <div className="space-y-2.5">
      <div className="relative z-30">
        <FilterSearchField value={query} onChange={setQuery} placeholder={placeholder} />

        {!loading && showSearchResults && options.length > 0 && (
          <div
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-white/10 bg-[#111114] p-1 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
            role="listbox"
            aria-label="Skill search results"
          >
            <FilterScrollList maxHeightClass={listMaxHeightClass}>
              {filtered.map((option) => {
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
              {filtered.length === 0 && (
                <li className="px-2 py-2.5 text-xs text-zinc-500">
                  No matching skills in your projects
                </li>
              )}
            </FilterScrollList>
          </div>
        )}
      </div>

      {loading && (
        <p className="px-1 text-xs text-zinc-500">Loading skills from your projects…</p>
      )}

      {!loading && options.length === 0 && (
        <p className="px-1 text-xs text-zinc-500">
          No skills yet. Discover projects to build the skills list.
        </p>
      )}

      {selected.length > 0 && (
        <div className="max-h-52 overflow-y-auto overscroll-contain border-t border-white/[0.06] pt-2.5 pr-1">
          <div className="flex flex-wrap gap-1.5">
            {sortedSelected.map((option) => (
              <FilterSelectedPill key={option.skill} onRemove={() => remove(option.skill)}>
                {option.skill}
              </FilterSelectedPill>
            ))}
          </div>
        </div>
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
