import { Details } from "@/components/home/details";
import { Faq, FinalCta } from "@/components/home/faq";
import { Hero } from "@/components/home/hero";
import { Marquee } from "@/components/home/marquee";
import { MoreThan, OurModel, WhyBackyard, WhyBbq } from "@/components/home/why";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublicSchedule, type PublicSchedule } from "@/lib/editions/public";
import { eventDateShort } from "@/lib/format";

export default async function Home() {
  const schedule = await getPublicSchedule();
  return (
    <>
      <SiteHeader cta={Boolean(schedule.openFor)} />
      <Announcements schedule={schedule} />
      <main className="flex-1">
        <Hero schedule={schedule} />
        <Marquee />
        <Details edition={schedule.featured} openFor={schedule.openFor} />
        <WhyBackyard />
        <WhyBbq />
        <OurModel />
        <MoreThan />
        <Faq soloOnly={(schedule.openFor ?? schedule.featured)?.maxGuests === 0} />
        <FinalCta schedule={schedule} />
      </main>
      <SiteFooter cta={Boolean(schedule.openFor)} />
    </>
  );
}

/** A called-off date, and the next edition's notice (a venue change, say). */
function Announcements({ schedule: { calledOff, featured } }: { schedule: PublicSchedule }) {
  if (!calledOff && !featured?.notice) return null;
  return (
    <div role="status">
      {calledOff && (
        <p className="bg-red px-4 py-3 text-center font-semibold text-cream">
          {eventDateShort(calledOff)} is called off.
          {calledOff.calledOffNote && ` ${calledOff.calledOffNote}`}{" "}
          {featured
            ? `Next one: ${eventDateShort(featured)}.`
            : "We’ll announce the next date soon."}
        </p>
      )}
      {featured?.notice && (
        <p className="bg-mustard px-4 py-3 text-center font-semibold text-forest-deep">
          {eventDateShort(featured)}: {featured.notice}
        </p>
      )}
    </div>
  );
}
