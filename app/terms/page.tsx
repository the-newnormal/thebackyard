import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { terms, type TermsBlock } from "@/content/terms";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description:
    "The terms for signing up for and taking part in Backyard, and how Backyard SG handles your personal data under Singapore’s PDPA.",
};

const linkClass =
  "font-semibold text-forest underline decoration-2 underline-offset-4 hover:text-vermilion";

/** Renders **bold** and *italic* parts of a line, and email addresses as links. */
function rich(text: string) {
  return text
    .split(/(\*\*.+?\*\*|\*.+?\*|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g)
    .map((part, i) => {
      if (i % 2 === 0) return part;
      if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
      return (
        <a key={i} href={`mailto:${part}`} className={linkClass}>
          {part}
        </a>
      );
    });
}

function Blocks({ blocks }: { blocks: TermsBlock[] }) {
  return blocks.map((block, i) =>
    typeof block === "string" ? (
      <p key={i}>{rich(block)}</p>
    ) : (
      <ul key={i} className="list-disc space-y-2 pl-6 marker:text-orange">
        {block.map((item, j) =>
          typeof item === "string" ? (
            <li key={j}>{rich(item)}</li>
          ) : (
            <li key={j}>
              {rich(item.text)}
              <ul className="mt-2 list-[circle] space-y-2 pl-6">
                {item.items.map((sub, k) => (
                  <li key={k}>{rich(sub)}</li>
                ))}
              </ul>
            </li>
          ),
        )}
      </ul>
    ),
  );
}

export default function TermsPage() {
  return (
    <>
      <SiteHeader cta={false} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-14 pb-24 sm:px-6 sm:pt-20">
        <p className="font-heading text-xs tracking-widest text-orange-ink uppercase">
          Backyard SG
        </p>
        <h1 className="mt-2 font-brush text-[clamp(3.25rem,13vw,6rem)] leading-[0.9] text-forest">
          terms and conditions
        </h1>
        <p className="mt-4 font-serif text-xl text-muted italic">
          last updated {terms.updated}
        </p>

        <nav
          aria-label="On this page"
          className="mt-10 rounded-2xl border-2 border-forest/15 bg-card p-5 sm:p-6"
        >
          <p className="font-heading text-sm text-forest">On this page</p>
          <ul className="mt-3 space-y-2 text-lg">
            {terms.parts.map((part) => (
              <li key={part.id}>
                <a href={`#${part.id}`} className={linkClass}>
                  {part.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-12 space-y-4 text-lg leading-relaxed text-ink">
          <h2 className="font-serif text-3xl text-forest sm:text-4xl">{terms.about.heading}</h2>
          <Blocks blocks={terms.about.blocks} />
        </div>

        {terms.parts.map((part) => (
          <section
            key={part.id}
            id={part.id}
            aria-labelledby={`${part.id}-title`}
            className="mt-16 space-y-4 border-t-2 border-dashed border-forest/20 pt-12 text-lg leading-relaxed text-ink"
          >
            <h2 id={`${part.id}-title`} className="font-serif text-3xl text-forest sm:text-4xl">
              {part.title}
            </h2>
            <Blocks blocks={part.intro} />
            {part.sections.map((section) => (
              <div key={section.heading} className="space-y-4 pt-6">
                <h3 className="font-serif text-2xl text-forest sm:text-[1.75rem]">
                  {section.heading}
                </h3>
                <Blocks blocks={section.blocks} />
              </div>
            ))}
            <p className="pt-6 text-muted italic">{part.dated}</p>
          </section>
        ))}
      </main>
      <SiteFooter cta={false} />
    </>
  );
}
