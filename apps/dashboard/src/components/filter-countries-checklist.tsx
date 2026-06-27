"use client";

import { useMemo, useState } from "react";
import { CountryFlag } from "@/components/country-flag";
import {
  FilterCheckboxRow,
  FilterScrollList,
  FilterSearchField,
  FilterSelectedPill,
} from "@/components/filter-checkbox";
import { COUNTRIES, findCountryByName, type CountryOption } from "@/lib/countries";

export function FilterCountriesChecklist({
  options = COUNTRIES,
  selected,
  onChange,
  placeholder = "Search countries to exclude",
  listMaxHeightClass = "max-h-56",
}: {
  options?: CountryOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  listMaxHeightClass?: string;
}) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selected.map((s) => s.toLowerCase())), [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (country) =>
        country.name.toLowerCase().includes(q) || country.code.toLowerCase().includes(q),
    );
  }, [options, query]);

  function remove(name: string) {
    const key = name.toLowerCase();
    onChange(selected.filter((item) => item.toLowerCase() !== key));
  }

  function toggle(country: CountryOption) {
    const key = country.name.toLowerCase();
    if (selectedSet.has(key)) {
      onChange(selected.filter((item) => item.toLowerCase() !== key));
      return;
    }
    onChange([...selected, country.name]);
  }

  return (
    <div className="space-y-2.5">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((name) => {
            const country = findCountryByName(name);
            return (
              <FilterSelectedPill
                key={name}
                onRemove={() => remove(name)}
                leading={
                  <CountryFlag countryCode={country?.code} countryName={name} size="sm" />
                }
              >
                {name}
              </FilterSelectedPill>
            );
          })}
        </div>
      )}

      <FilterSearchField value={query} onChange={setQuery} placeholder={placeholder} />

      <FilterScrollList maxHeightClass={listMaxHeightClass}>
        {filtered.map((country) => {
          const checked = selectedSet.has(country.name.toLowerCase());
          return (
            <li key={country.code}>
              <FilterCheckboxRow
                checked={checked}
                onToggle={() => toggle(country)}
                leading={
                  <CountryFlag
                    countryCode={country.code}
                    countryName={country.name}
                    size="sm"
                  />
                }
              >
                {country.name}
              </FilterCheckboxRow>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-2 py-2.5 text-xs text-zinc-500">No matching countries</li>
        )}
      </FilterScrollList>
    </div>
  );
}
