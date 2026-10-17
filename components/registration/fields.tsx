"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { COUNTRIES, type Country } from "./countries";

/** Inline links, as on the home page. */
export const LINK =
  "font-semibold text-forest underline decoration-2 underline-offset-4 hover:text-vermilion";

export function ErrorText({ id, children }: { id: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-3 font-semibold text-red-ink">
      {children}
    </p>
  );
}

function Check({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`shrink-0 ${className}`} aria-hidden="true">
      <path
        d="M4 10.5l4 4 8-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Option = string | { value: string; label: string };

/** Big answer buttons. Picking one calls `onPick`; the step decides whether to move on. */
export function ChoiceGrid({
  options,
  value,
  onPick,
  labelledBy,
  describedBy,
  columns = 1,
  compact = false,
}: {
  options: readonly Option[];
  value: string;
  onPick: (value: string) => void;
  labelledBy: string;
  describedBy?: string;
  columns?: 1 | 2;
  compact?: boolean;
}) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={`grid gap-3 ${columns === 2 ? "grid-cols-2" : ""}`}
    >
      {options.map((option) => {
        const { value: v, label } = typeof option === "string" ? { value: option, label: option } : option;
        const picked = v === value;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={picked}
            onClick={() => onPick(v)}
            className={`choice ${compact ? "min-h-14 px-4 py-3 text-base" : ""}`}
          >
            <span>{label}</span>
            {picked && <Check />}
          </button>
        );
      })}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted"
      aria-hidden="true"
    >
      <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M13 13l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const simplify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * A search box over a long list (schools, races). Arrow keys move through the
 * matches and Enter picks one, as in a combobox.
 */
export function SearchList({
  options,
  value,
  onPick,
  label,
  placeholder,
  others,
  autoFocus = true,
}: {
  options: readonly string[];
  value: string;
  onPick: (value: string) => void;
  label: string;
  placeholder: string;
  /** Offered under the list, e.g. "Others". */
  others?: string;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  // Nothing is highlighted until they type or use the arrows, so Enter (the
  // phone keyboard's "done") can't pick a row they never chose.
  const [active, setActive] = useState(() => options.indexOf(value));
  const searchable = useMemo(() => options.map((o) => ({ option: o, text: simplify(o) })), [options]);
  const matches = useMemo(() => {
    const q = simplify(query);
    const words = q.split(" ").filter(Boolean);
    // A whole word matching comes first (so "ntu" finds NTU before NTUC), then
    // names starting with the search, then a word starting with it, then
    // anything containing it; A-Z within each.
    const rank = (text: string) =>
      ` ${text} `.includes(` ${q} `)
        ? 0
        : text.startsWith(q)
          ? 1
          : ` ${text}`.includes(` ${words[0]}`)
            ? 2
            : 3;
    return searchable
      .filter(({ text }) => words.every((w) => text.includes(w)))
      .map((s) => ({ ...s, rank: rank(s.text) }))
      .sort((a, b) => a.rank - b.rank)
      .map((s) => s.option);
  }, [searchable, query]);
  const optionId = (i: number) => `${listId}-${i}`;

  // Coming back to this step: show the answer already picked.
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "center" });
  }, []);

  function move(to: number) {
    const next = Math.min(Math.max(to, 0), matches.length - 1);
    setActive(next);
    document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div>
      <div className="relative">
        <SearchIcon />
        <input
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={matches[active] ? optionId(active) : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          enterKeyHint="done"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(e.target.value.trim() ? 0 : -1);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              move(active + 1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              move(active - 1);
            } else if (e.key === "Home" || e.key === "End") {
              e.preventDefault();
              move(e.key === "Home" ? 0 : matches.length - 1);
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (matches[active]) onPick(matches[active]);
              // Otherwise just put the keyboard away so they can scroll.
              else e.currentTarget.blur();
            }
          }}
          className="field h-14 pl-12 text-lg"
        />
      </div>

      {/* Kept even when empty, since the box above points at it. */}
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={label}
        hidden={matches.length === 0}
        className="mt-3 max-h-[min(48vh,26rem)] space-y-1 overflow-y-auto overscroll-contain rounded-2xl border-2 border-forest/15 bg-card p-1.5"
      >
        {matches.map((option, i) => (
          <li
            key={option}
            id={optionId(i)}
            role="option"
            aria-selected={option === value}
            onClick={() => onPick(option)}
            onMouseMove={() => active !== i && setActive(i)}
            // The transparent outline shows up in high-contrast modes, which drop backgrounds.
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-3 font-semibold text-ink aria-selected:bg-forest aria-selected:text-cream ${
              i === active ? "bg-cream outline-2 outline-transparent" : ""
            }`}
          >
            <span>{option}</span>
            {option === value && <Check />}
          </li>
        ))}
      </ul>
      {matches.length === 0 && (
        <p className="mt-3 rounded-2xl border-2 border-forest/15 bg-card px-4 py-6 text-center text-muted">
          Nothing matches “{query.trim()}”. Try fewer letters
          {others ? "." : ", or check the spelling."}
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {query.trim() ? `${matches.length} ${matches.length === 1 ? "match" : "matches"}` : ""}
      </p>
      {others && (
        <p className="mt-3 text-muted">
          Can’t find yours?{" "}
          <button type="button" onClick={() => onPick(others)} className={LINK}>
            Pick “{others}”
          </button>
        </p>
      )}
    </div>
  );
}

/** The flag-and-code button beside the mobile number, with a searchable list. */
export function CountryPicker({
  value,
  onChange,
  disabled,
}: {
  value: Country;
  onChange: (country: Country) => void;
  disabled?: boolean;
}) {
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(q) || c.code.includes(q.replace(/^(?=\d)/, "+")),
  );
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Country code: ${value.name} ${value.code}`}
        onClick={() => {
          setOpen(!open);
          setQuery("");
        }}
        className="field flex h-16 w-auto items-center gap-2 px-3.5 text-lg font-semibold"
      >
        <span aria-hidden="true">{value.flag}</span>
        <span>{value.code}</span>
        <svg viewBox="0 0 20 20" className="size-4 text-muted" aria-hidden="true">
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={close} aria-hidden="true" />
          <div
            id={panelId}
            className="absolute top-full left-0 z-40 mt-2 w-72 overflow-hidden rounded-2xl border-2 border-forest bg-card shadow-[6px_6px_0_var(--color-forest)]"
            onKeyDown={(e) => e.key === "Escape" && close()}
            // Tabbing out of the list closes it, rather than leaving it over the
            // page. A click outside lands on the backdrop, which closes it too.
            onBlur={(e) => {
              if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setOpen(false);
            }}
          >
            <div className="relative border-b-2 border-forest/10 p-2">
              <SearchIcon />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Pick the top match rather than submitting the number.
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  if (matches[0]) {
                    onChange(matches[0]);
                    setOpen(false);
                  }
                }}
                placeholder="Search country…"
                aria-label="Search countries"
                className="field h-11 pl-10 text-base"
              />
            </div>
            <ul aria-label="Countries" className="max-h-60 overflow-y-auto p-1">
              {matches.map((c) => (
                <li key={c.name}>
                  <button
                    type="button"
                    aria-current={c.name === value.name}
                    onClick={() => {
                      onChange(c);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-cream ${
                      c.name === value.name ? "bg-cream" : ""
                    }`}
                  >
                    <span aria-hidden="true">{c.flag}</span>
                    <span className="flex-1 font-semibold text-ink">{c.name}</span>
                    <span className="text-muted tabular-nums">{c.code}</span>
                    {c.name === value.name && <Check className="size-4 text-forest" />}
                  </button>
                </li>
              ))}
              {matches.length === 0 && (
                <li className="px-3 py-4 text-center text-muted">
                  No countries found
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

const DATE_PARTS = [
  { label: "Day", placeholder: "DD", length: 2, autoComplete: "bday-day", width: "w-20" },
  { label: "Month", placeholder: "MM", length: 2, autoComplete: "bday-month", width: "w-20" },
  { label: "Year", placeholder: "YYYY", length: 4, autoComplete: "bday-year", width: "w-28" },
] as const;

/** A whole date typed, pasted or autofilled into one box: DD/MM/YYYY, DDMMYYYY or YYYY-MM-DD. */
function wholeDate(raw: string): string[] | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw.trim());
  if (iso) return [iso[3], iso[2], iso[1]].map((p, i) => (i < 2 ? p.padStart(2, "0") : p));
  const dmy = /^(\d{1,2})[/.\-\s]+(\d{1,2})[/.\-\s]+(\d{4})$/.exec(raw.trim());
  if (dmy) return [dmy[1].padStart(2, "0"), dmy[2].padStart(2, "0"), dmy[3]];
  const run = /^(\d{2})(\d{2})(\d{4})$/.exec(raw.trim());
  return run ? [run[1], run[2], run[3]] : null;
}

/** Day, month and year boxes, kept together as "DD/MM/YYYY". */
export function BirthdateFields({
  value,
  onChange,
  labelledBy,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (value: string) => void;
  labelledBy: string;
  invalid: boolean;
  describedBy?: string;
}) {
  const day = useRef<HTMLInputElement>(null);
  const month = useRef<HTMLInputElement>(null);
  const year = useRef<HTMLInputElement>(null);
  const boxes = [day, month, year];
  const [d = "", m = "", y = ""] = value.split("/");
  const parts = [d, m, y];

  const save = (next: string[]) => onChange(next.some(Boolean) ? next.join("/") : "");

  function change(i: number, raw: string) {
    const whole = wholeDate(raw);
    if (whole) {
      save(whole);
      year.current?.focus();
      return;
    }
    const digits = raw.replace(/\D/g, "").slice(0, DATE_PARTS[i].length);
    save(parts.map((p, j) => (j === i ? digits : p)));
    if (digits.length === DATE_PARTS[i].length && i < 2) boxes[i + 1].current?.focus();
  }

  function keyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !parts[i] && i > 0) {
      e.preventDefault();
      boxes[i - 1].current?.focus();
    } else if (["/", ".", "-", " "].includes(e.key) && i < 2) {
      // "1/" means the 1st: pad it and move on.
      e.preventDefault();
      if (!parts[i]) return;
      save(parts.map((p, j) => (j === i ? p.padStart(2, "0") : p)));
      boxes[i + 1].current?.focus();
    }
  }

  return (
    <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className="flex gap-3">
      {DATE_PARTS.map((part, i) => (
        <label key={part.label} className="flex flex-col">
          <span className="mb-1.5 text-sm font-bold text-forest">{part.label}</span>
          <input
            ref={boxes[i]}
            autoFocus={i === 0}
            inputMode="numeric"
            autoComplete={part.autoComplete}
            enterKeyHint={i === 2 ? "next" : undefined}
            aria-invalid={invalid || undefined}
            value={parts[i]}
            onChange={(e) => change(i, e.target.value)}
            onKeyDown={(e) => keyDown(i, e)}
            onFocus={(e) => e.target.select()}
            placeholder={part.placeholder}
            className={`field h-16 ${part.width} px-0 text-center text-2xl tabular-nums`}
          />
        </label>
      ))}
    </div>
  );
}
