import { brand } from "@/content/copy";
import { series } from "@/content/series";
import { Starburst } from "../shapes";

const words = [...series.tagline, ...brand.personality];

function Run() {
  return (
    <div className="flex shrink-0 items-center gap-6 pr-6" aria-hidden="true">
      {words.map((word, i) => (
        <span key={word} className="flex items-center gap-6">
          <span className="font-display text-3xl whitespace-nowrap text-lime sm:text-4xl">
            {word}
          </span>
          <Starburst
            variant={(i % 3) as 0 | 1 | 2}
            scribble={false}
            color={i % 2 ? "var(--color-orange)" : "var(--color-mustard)"}
            className="size-7 shrink-0"
          />
        </span>
      ))}
    </div>
  );
}

export function Marquee() {
  return (
    <div className="relative z-10 -my-3 -rotate-[1.5deg] overflow-hidden border-y-4 border-forest-deep bg-forest py-4">
      <p className="sr-only">{words.join(", ")}</p>
      <div className="flex w-max animate-marquee">
        <Run />
        <Run />
      </div>
    </div>
  );
}
