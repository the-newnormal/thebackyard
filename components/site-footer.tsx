import Link from "next/link";
import { brand } from "@/content/copy";
import { series } from "@/content/series";
import { Starburst } from "./shapes";

/** `cta`: show the "Save your spot" link (only while a date takes sign-ups). */
export function SiteFooter({ cta = true }: { cta?: boolean }) {
  const { email, instagram } = series.contact;
  return (
    <footer className="relative overflow-hidden bg-forest-deep text-cream">
      <Starburst
        variant={1}
        color="var(--color-orange)"
        className="absolute -right-10 -bottom-12 w-40 opacity-90 sm:w-56"
      />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="font-display text-5xl text-lime sm:text-6xl">BACKYARD</p>
          <p className="mt-3 font-serif text-2xl italic text-cream/90">{brand.line}</p>
        </div>
        <div className="space-y-2 text-cream/85">
          <p className="font-heading text-lg text-cream">{series.name}</p>
          <p>A free community BBQ in Singapore, every month.</p>
          {(email || instagram) && (
            <p className="flex flex-wrap gap-x-4 pt-2">
              {email && (
                <a className="underline underline-offset-4 hover:text-lime" href={`mailto:${email}`}>
                  {email}
                </a>
              )}
              {instagram && (
                <a
                  className="underline underline-offset-4 hover:text-lime"
                  href={`https://instagram.com/${instagram}`}
                >
                  @{instagram}
                </a>
              )}
            </p>
          )}
        </div>
      </div>
      <div className="relative border-t border-cream/15">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-sm text-cream/60 sm:px-6">
          <p className="flex flex-wrap gap-x-5 gap-y-2">
            <span>
              Hosted by {series.organiser}
              {series.coOrganiser && ` with ${series.coOrganiser}`}
            </span>
            <Link href="/terms" className="hover:text-lime">
              Terms &amp; Conditions
            </Link>
          </p>
          {cta && (
            <Link href="/register" className="hover:text-lime">
              Save your spot →
            </Link>
          )}
        </div>
      </div>
    </footer>
  );
}
