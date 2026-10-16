"use client";

import Link from "next/link";

export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-serif text-2xl text-muted italic">the grill flared up</p>
      <h1 className="mt-2 font-brush text-6xl leading-none text-forest sm:text-7xl">
        something went wrong
      </h1>
      <p className="mx-auto mt-5 max-w-md text-lg text-ink">
        It’s probably a hiccup on our side. Give it another go in a moment.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-outline text-forest">
          Back to home
        </Link>
      </div>
    </main>
  );
}
