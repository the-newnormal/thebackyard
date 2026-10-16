import Link from "next/link";
import { faqs } from "@/content/copy";
import { event } from "@/content/event";
import { Starburst } from "../shapes";

const linkClass = "font-semibold text-forest underline decoration-2 underline-offset-4 hover:text-vermilion";

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 text-xl font-bold text-forest [&::-webkit-details-marker]:hidden">
        {q}
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-forest text-2xl leading-none text-cream transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <p className="pr-12 pb-5 text-lg leading-relaxed text-ink">{children}</p>
    </details>
  );
}

function ContactAnswer({ email, instagram }: { email: string; instagram: string }) {
  const mail = email && (
    <a href={`mailto:${email}`} className={linkClass}>
      {email}
    </a>
  );
  const insta = instagram && (
    <a href={`https://instagram.com/${instagram}`} className={linkClass}>
      @{instagram}
    </a>
  );
  return (
    <>
      Questions, or want your details removed?{" "}
      {mail && insta ? (
        <>
          Email {mail} or DM {insta} on Instagram.
        </>
      ) : mail ? (
        <>Email {mail}.</>
      ) : (
        <>DM {insta} on Instagram.</>
      )}
    </>
  );
}

export function Faq() {
  const { email, instagram } = event.contact;
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-24 sm:px-6 sm:py-32">
      <h2 className="font-brush text-7xl leading-none text-forest sm:text-8xl">good to know</h2>
      <div className="mt-10 divide-y-2 divide-dashed divide-forest/20 border-y-2 border-dashed border-forest/20">
        {faqs.map((faq) => (
          <FaqItem key={faq.q} q={faq.q}>
            {faq.a}
          </FaqItem>
        ))}
        {(email || instagram) && (
          <FaqItem q="Got a question?">
            <ContactAnswer email={email} instagram={instagram} />
          </FaqItem>
        )}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden bg-red px-4 py-24 text-center text-cream sm:py-28">
      <Starburst
        variant={2}
        color="var(--color-mustard)"
        scribble={false}
        className="absolute top-8 left-[6%] -z-10 w-16 rotate-12 sm:w-24"
      />
      <Starburst
        color="var(--color-rust)"
        className="absolute right-[4%] bottom-6 -z-10 w-24 -rotate-12 sm:w-36"
      />
      <p className="font-serif text-2xl italic sm:text-3xl">pull up a chair —</p>
      <h2 className="mt-2 font-brush text-[clamp(4rem,13vw,9rem)] leading-[0.9]">
        see you in the backyard
      </h2>
      <Link
        href="/register"
        className="btn mt-10 bg-cream px-8 py-4 text-lg text-red shadow-[4px_4px_0_var(--color-rust)] hover:bg-mustard hover:text-forest-deep"
      >
        Register for free <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
