import Link from "next/link";

const links = [
  { href: "/#why", label: "Why Backyard" },
  { href: "/#details", label: "The night" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader({ cta = true }: { cta?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-forest/10 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="font-display text-2xl text-forest" aria-label="Backyard home">
          BACKYARD
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hidden rounded-full px-3 py-2 font-semibold text-forest transition-colors hover:bg-forest/10 md:inline-flex"
            >
              {link.label}
            </Link>
          ))}
          {cta && (
            <Link href="/register" className="btn btn-primary ml-2 px-5 py-2.5 text-sm">
              Register
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
