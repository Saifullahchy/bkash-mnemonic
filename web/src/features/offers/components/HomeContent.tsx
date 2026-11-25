import { Container } from "@/components/layout/Container";
import { ModalRoot } from "@/components/modals/ModalRoot";
import { TermsSection } from "@/features/terms/components/TermsSection";
import { getHomePageData } from "../api/homeData";
import { HomeHero } from "./HomeHero";
import { OfferSection } from "./OfferSection";

/**
 * Server Component: fetches public data from the API at request time and
 * streams in behind the page's Suspense boundary. Personal data (session,
 * activity, links) is loaded client-side via RTK Query with the user's cookie.
 */
export async function HomeContent() {
  const { offers, stats, terms } = await getHomePageData();

  return (
    <>
      {/* Figma: content is 351px wide on a 375px screen (12px sides); 40px below the hero card. */}
      <Container className="space-y-7 px-3 pt-6 pb-7 md:space-y-8 md:pt-8 md:pb-14">
        <div className="motion-safe:animate-fade-up pb-3">
          <HomeHero peopleSharingToday={stats.peopleSharingToday} />
        </div>
        <OfferSection offers={offers} />
      </Container>
      {terms && (
        // Terms + footer are always visible: no scroll animation.
        <TermsSection title={terms.title} summary={terms.summary} />
      )}
      <ModalRoot offers={offers} terms={terms} />
    </>
  );
}
