import { brand, model, moreThan, whyBackyard, whyBbq } from "@/content/copy";
import { Plate, ScribbleArrow, Starburst } from "../shapes";

export function WhyBackyard() {
  return (
    <section id="why" className="relative overflow-hidden py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <p className="font-brush text-[clamp(6rem,22vw,15rem)] leading-[0.8] text-forest drop-shadow-[0_4px_6px_rgb(31_64_41/0.18)]">
            backyard
          </p>
          <p className="relative -mt-[0.2em] font-serif text-[clamp(1.6rem,4.5vw,3rem)] text-forest italic">
            {brand.line}
          </p>
        </div>

        <div className="mt-20 grid gap-12 md:grid-cols-2 md:gap-16">
          <article>
            <p className="font-heading text-2xl text-forest uppercase sm:text-3xl">
              {whyBackyard.kicker}
            </p>
            <h2 className="mt-2 font-heading text-3xl leading-tight text-forest sm:text-4xl">
              {whyBackyard.title}
            </h2>
            <p className="mt-6 font-serif text-[1.75rem] leading-[1.2] text-ink sm:text-[2.1rem]">
              {whyBackyard.body}
            </p>
          </article>

          <article className="relative rotate-1 rounded-2xl border-2 border-forest bg-card p-8 shadow-[8px_8px_0_var(--color-forest)] sm:p-10">
            <span className="tape -top-3 left-1/2 -translate-x-1/2 -rotate-3" aria-hidden="true" />
            <h3 className="font-heading text-3xl text-forest sm:text-4xl">{whyBackyard.idea.title}</h3>
            <p className="mt-4 font-serif text-2xl leading-snug text-ink sm:text-[1.7rem]">
              {whyBackyard.idea.body}
            </p>
            <p className="mt-6 font-display text-xl text-vermilion">eat · serve · love</p>
          </article>
        </div>
      </div>
    </section>
  );
}

const stickerColors = [
  "bg-mustard text-forest-deep -rotate-3",
  "bg-coral text-card rotate-2",
  "bg-lime text-forest-deep -rotate-2",
  "bg-cream text-vermilion rotate-3",
];

export function WhyBbq() {
  const { foodFirst } = whyBbq;
  return (
    <section className="relative overflow-hidden border-y-4 border-orange/30 bg-cream/60 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
        <p className="font-heading text-2xl text-vermilion uppercase sm:text-3xl">{whyBbq.kicker}</p>
        <h2 className="mt-2 font-heading text-3xl leading-tight text-vermilion sm:text-5xl">
          {whyBbq.title}
        </h2>

        <div className="relative mx-auto mt-10 max-w-3xl">
          <ScribbleArrow className="absolute -top-10 -left-4 hidden w-24 -scale-x-100 sm:block" />
          <ScribbleArrow className="absolute -right-2 -bottom-14 hidden w-24 rotate-180 sm:block" />
          <ul className="flex flex-wrap justify-center gap-3 sm:gap-4">
            {whyBbq.answers.map((answer, i) => (
              <li
                key={answer}
                className={`rounded-full px-6 py-3 font-serif text-2xl italic shadow-[3px_3px_0_rgb(0_0_0/0.12)] sm:text-3xl ${stickerColors[i % stickerColors.length]}`}
              >
                {answer}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-24">
          <h3 className="font-heading text-3xl text-vermilion sm:text-4xl">{foodFirst.title}</h3>
          <figure className="mx-auto mt-6 max-w-3xl">
            <blockquote className="font-serif text-[clamp(1.6rem,4vw,2.6rem)] leading-tight text-vermilion italic">
              “{foodFirst.quote}”
            </blockquote>
            <figcaption className="mt-3 font-serif text-xl text-orange-ink italic">
              — {foodFirst.quoteBy}
            </figcaption>
          </figure>
          <div className="mx-auto mt-10 max-w-2xl space-y-5 text-left text-lg leading-relaxed text-ink sm:text-center sm:text-xl">
            {foodFirst.body.map((p, i) => (
              <p key={i} className={i === foodFirst.body.length - 1 ? "font-semibold text-vermilion" : ""}>
                {p}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function OurModel() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-heading text-2xl text-red uppercase sm:text-3xl">{model.kicker}</p>
            <h2 className="mt-2 font-heading text-3xl text-red sm:text-5xl">{model.title}:</h2>
          </div>
          <Plate className="w-40 -rotate-6 sm:w-52" />
        </div>

        <ol className="mt-12 grid gap-6 md:grid-cols-2">
          {model.prongs.map((prong, i) => (
            <li
              key={prong.name}
              className={`relative rounded-2xl border-2 border-red bg-card p-8 sm:p-10 ${i ? "md:mt-12 md:rotate-1" : "md:-rotate-1"}`}
            >
              <span className="font-display text-7xl text-red/90">{i + 1}.</span>
              <h3 className="mt-3 font-display text-4xl text-red uppercase sm:text-5xl">
                {prong.name}
              </h3>
              <p className="mt-4 text-lg leading-relaxed text-ink sm:text-xl">{prong.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function MoreThan() {
  return (
    <section className="relative isolate overflow-hidden bg-forest py-24 text-cream sm:py-32">
      <Starburst
        variant={1}
        color="var(--color-mustard)"
        scribble={false}
        className="absolute -top-20 -right-20 -z-10 w-40 sm:-top-14 sm:-right-12 sm:w-64"
      />
      <Starburst
        color="var(--color-rust)"
        className="absolute -bottom-24 -left-20 -z-10 w-44 sm:-bottom-16 sm:-left-14 sm:w-72"
      />
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <h2 className="font-display text-[clamp(2.6rem,8vw,5.5rem)] text-lime">
          {moreThan.title}
        </h2>
        <p className="mx-auto mt-8 max-w-3xl font-serif text-[clamp(1.6rem,3.6vw,2.4rem)] leading-snug">
          {moreThan.body}
        </p>
      </div>
    </section>
  );
}
