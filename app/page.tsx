import { Details } from "@/components/home/details";
import { Faq, FinalCta } from "@/components/home/faq";
import { Hero } from "@/components/home/hero";
import { Marquee } from "@/components/home/marquee";
import { MoreThan, OurModel, WhyBackyard, WhyBbq } from "@/components/home/why";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Marquee />
        <Details />
        <WhyBackyard />
        <WhyBbq />
        <OurModel />
        <MoreThan />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
