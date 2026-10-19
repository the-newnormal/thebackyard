import Link from "next/link";

/** Top bar for every signed-in admin page. */
export function AdminHeader() {
  return (
    <header className="border-b-2 border-forest/10 bg-paper/90">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="font-display text-2xl text-forest">
            BACKYARD
          </Link>
          <span className="font-serif text-xl text-muted italic">dashboard</span>
        </div>
        <nav className="flex items-center gap-1">
          <Link href="/admin" className="btn px-4 py-2 text-sm text-forest hover:bg-forest/10">
            Guests
          </Link>
          <Link
            href="/admin/editions"
            className="btn px-4 py-2 text-sm text-forest hover:bg-forest/10"
          >
            Dates
          </Link>
          <Link
            href="/admin/opt-outs"
            className="btn px-4 py-2 text-sm text-forest hover:bg-forest/10"
          >
            Opt-outs
          </Link>
          {/* A full page load on sign-out, so no guest data lingers in the page. */}
          <form method="post" action="/admin/logout">
            <button type="submit" className="btn px-4 py-2 text-sm text-muted hover:text-red">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
