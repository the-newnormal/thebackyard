"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { COUNTRIES, type Country } from "./countries";

export function ErrorText({ id, children }: { id: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-3 font-semibold text-red">
      {children}
    </p>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="size-5 shrink-0" aria-hidden="true">
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
  columns = 1,
  compact = false,
}: {
  options: readonly Option[];
  value: string;
  onPick: (value: string) => void;
  labelledBy: string;
  columns?: 1 | 2;
  compact?: boolean;
}) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
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
  const [active, setActive] = useState(() => Math.max(0, options.indexOf(value)));
  const searchable = useMemo(() => options.map((o) => ({ option: o, text: simplify(o) })), [options]);
  const matches = useMemo(() => {
    const q = simplify(query);
    const words = q.split(" ").filter(Boolean);
    // Names starting with the search come first, then a word starting with it,
    // then anything containing it; A-Z within each.
    const rank = (text: string) =>
      text.startsWith(q) ? 0 : ` ${text}`.includes(` ${words[0]}`) ? 1 : 2;
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
        <svg
          viewBox="0 0 20 20"
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted"
          aria-hidden="true"
        >
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M13 13l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={matches.length ? optionId(active) : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          enterKeyHint="done"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              move(active + 1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              move(active - 1);
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (matches[active]) onPick(matches[active]);
            }
          }}
          className="field h-14 pl-12 text-lg"
        />
      </div>

      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={label}
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
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-3 font-semibold text-ink aria-selected:bg-forest aria-selected:text-cream ${
              i === active ? "bg-cream" : ""
            }`}
          >
            <span>{option}</span>
            {option === value && <Check />}
          </li>
        ))}
        {matches.length === 0 && (
          <li className="px-4 py-6 text-center text-muted" role="presentation">
            Nothing matches “{query.trim()}”. Try fewer letters
            {others ? "." : ", or check the spelling."}
          </li>
        )}
      </ul>
      {others && (
        <p className="mt-3 text-muted">
          Can’t find yours?{" "}
          <button
            type="button"
            onClick={() => onPick(others)}
            className="font-semibold text-forest underline underline-offset-4 hover:text-orange-ink"
          >
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
}: {
  value: Country;
  onChange: (country: Country) => void;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(q) || c.code.includes(q.replace(/^(?=\d)/, "+")),
  );

  return (
    <div className="relative shrink-0">
      <button
        type="button"
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
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            id={panelId}
            className="absolute top-full left-0 z-40 mt-2 w-72 overflow-hidden rounded-2xl border-2 border-forest bg-card shadow-[6px_6px_0_var(--color-forest)]"
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          >
            <div className="border-b-2 border-forest/10 p-2">
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country…"
                aria-label="Search countries"
                className="w-full rounded-xl bg-cream/70 px-3 py-2 text-ink outline-none placeholder:text-muted"
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
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-cream"
                  >
                    <span aria-hidden="true">{c.flag}</span>
                    <span className="flex-1 font-semibold text-ink">{c.name}</span>
                    <span className="text-muted tabular-nums">{c.code}</span>
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
