"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";

export const BUDGET_TYPE_OPTIONS = [
  { value: "any", label: "All types" },
  { value: "fixed", label: "Fixed" },
  { value: "hourly", label: "Hourly" },
] as const;

export const POSTED_WITHIN_OPTIONS = [
  { value: "", label: "Any time" },
  { value: "1", label: "Last 24 hours" },
  { value: "3", label: "Last 3 days" },
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
] as const;

export const fieldBase =
  "h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] text-[13px] text-zinc-200 outline-none transition placeholder:text-zinc-500 hover:border-white/15 focus:border-indigo-500/50 focus:bg-white/[0.05] focus:ring-2 focus:ring-indigo-500/20";

type Option = { value: string; label: string };

export function FilterSelect({
  value,
  onChange,
  options,
  className = "",
  name,
  defaultValue,
  disabled,
  size = "default",
  "aria-label": ariaLabel,
}: {
  value?: string;
  onChange?: (value: string) => void;
  options: readonly Option[];
  className?: string;
  name?: string;
  defaultValue?: string;
  disabled?: boolean;
  size?: "default" | "comfortable" | "toolbar";
  "aria-label"?: string;
}) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const isControlled = onChange !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? value ?? options[0]?.value ?? "");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const current = isControlled ? (value ?? "") : internal;
  const selectedIndex = options.findIndex((o) => o.value === current);
  const selected = options[selectedIndex >= 0 ? selectedIndex : 0];

  function pick(next: string) {
    if (!isControlled) setInternal(next);
    onChange?.(next);
    setOpen(false);
    setHighlight(-1);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setHighlight(-1);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  }

  const sizeClass =
    size === "toolbar"
      ? "h-10 rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] text-sm shadow-sm shadow-black/20"
      : size === "comfortable"
        ? "h-10 rounded-xl text-[15px]"
        : fieldBase;

  const listClass =
    size === "toolbar"
      ? "rounded-xl border border-white/10 bg-[#0f0f14]/98 p-1.5 shadow-2xl shadow-black/60 ring-1 ring-indigo-500/10 backdrop-blur-xl"
      : "rounded-xl border border-white/10 bg-[#121218]/95 p-1.5 shadow-2xl shadow-black/50 ring-1 ring-white/[0.06] backdrop-blur-xl";

  const optionClass =
    size === "toolbar"
      ? "rounded-lg px-3 py-2 text-sm"
      : "rounded-md px-2.5 py-1.5 text-[13px]";

  function onListKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setHighlight(-1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => (i + 1) % options.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => (i - 1 + options.length) % options.length);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const option = options[highlight >= 0 ? highlight : selectedIndex];
      if (option) pick(option.value);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={current} readOnly />}

      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className={`${sizeClass} flex w-full items-center justify-between gap-2 px-3.5 text-left text-zinc-200 outline-none transition placeholder:text-zinc-500 hover:border-white/15 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? "border-indigo-500/50 bg-white/[0.05] ring-2 ring-indigo-500/20" : ""
        }`}
      >
        <span className="truncate">{selected?.label ?? "Select…"}</span>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${
            open ? "rotate-180 text-indigo-300" : ""
          }`}
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className={`absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden ${listClass}`}
        >
          {options.map((option, index) => {
            const isSelected = option.value === current;
            const isHighlighted = index === highlight;
            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => pick(option.value)}
                  className={`flex w-full items-center text-left transition ${optionClass} ${
                    isSelected
                      ? "bg-indigo-500/12 text-indigo-200"
                      : isHighlighted
                        ? "bg-white/[0.06] text-zinc-100"
                        : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
                  }`}
                >
                  <span className="flex-1 truncate">{option.label}</span>
                  {isSelected && (
                    <svg viewBox="0 0 16 16" fill="none" className="ml-2 h-3.5 w-3.5 shrink-0 text-indigo-400" aria-hidden>
                      <path
                        d="M3.5 8.2 6.4 11 12.5 5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function FilterInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldBase} px-3 ${className}`} />;
}

const numberInputClass =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]";

export function FilterNumberInput({
  value,
  onChange,
  onCommit,
  className = "",
  min = 0,
  step = 1,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  step?: number;
}) {
  function commit(next: string) {
    onChange(next);
    onCommit?.(next);
  }

  function adjust(delta: number) {
    const current = value === "" ? 0 : Number(value);
    if (Number.isNaN(current)) return;
    commit(String(Math.max(min as number, current + delta * step)));
  }

  return (
    <div className={`relative ${className}`}>
      <input
        {...props}
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onCommit?.(e.target.value)}
        className={`${fieldBase} ${numberInputClass} pr-9 pl-3`}
      />
      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-md border border-white/10 bg-[#16161c]">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Increase"
          onClick={() => adjust(1)}
          className="flex h-3.5 w-5 items-center justify-center text-zinc-500 transition hover:bg-white/[0.08] hover:text-zinc-200"
        >
          <svg viewBox="0 0 8 8" className="h-2 w-2" fill="none" aria-hidden>
            <path d="M1 5.5 4 2.5 7 5.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="h-px bg-white/10" />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Decrease"
          onClick={() => adjust(-1)}
          className="flex h-3.5 w-5 items-center justify-center text-zinc-500 transition hover:bg-white/[0.08] hover:text-zinc-200"
        >
          <svg viewBox="0 0 8 8" className="h-2 w-2" fill="none" aria-hidden>
            <path d="M1 2.5 4 5.5 7 2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function formatBudgetTypeLabel(type?: string | null): string | null {
  if (type === "fixed") return "Fixed";
  if (type === "hourly") return "Hourly";
  return null;
}
