import Link from "next/link";
import { Starburst } from "@/components/shapes";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="relative isolate flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-24 text-center">
        <Starburst className="absolute top-8 -left-12 -z-10 w-40 -rotate-12 sm:w-56" />
        <p className="font-serif text-2xl text-muted italic">hmm, nobody’s out here</p>
        <h1 className="mt-2 font-brush text-7xl leading-none text-forest sm:text-8xl">
          wrong backyard
        </h1>
        <p className="mx-auto mt-5 max-w-md text-lg text-ink">
          We couldn’t find that page. If you were looking for your pass, check the link in your
          confirmation.
        </p>
        <Link href="/" className="btn btn-primary mt-8">
          Back to the party
        </Link>
      </main>
    </>
  );
}
