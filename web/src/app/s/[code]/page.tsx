import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/layout/Container";
import { getShareLanding } from "@/features/tracking/api/landingData";
import { ShareLandingView } from "@/features/tracking/components/ShareLandingView";

/**
 * Rich previews when the link is pasted into WhatsApp/Messenger. Crawlers get
 * the fully rendered HTML (they never run the open beacon, so they never count).
 */
export async function generateMetadata({ params }: PageProps<"/s/[code]">): Promise<Metadata> {
  const { code } = await params;
  const landing = await getShareLanding(code);
  if (!landing) return { title: "Offer not found", robots: { index: false } };

  const { offer } = landing;
  const title = `${offer.title} — ${offer.subtitle}`;
  const images = offer.bannerUrl ? [{ url: offer.bannerUrl, width: 686, height: 304 }] : [];
  return {
    title,
    description: offer.description || offer.subtitle,
    // Personal share links must not be indexed by search engines.
    robots: { index: false, follow: false },
    openGraph: { title, description: offer.description || offer.subtitle, images, type: "website" },
    twitter: { card: "summary_large_image", title, images: images.map((i) => i.url) },
  };
}

async function Landing({ params }: { params: PageProps<"/s/[code]">["params"] }) {
  const { code } = await params;
  const landing = await getShareLanding(code);
  if (!landing) notFound();
  return <ShareLandingView landing={landing} />;
}

function LandingSkeleton() {
  return (
    <Container className="px-4 pt-14 pb-8 md:max-w-[448px] md:px-4">
      <span className="sr-only">Loading offer…</span>
      <div aria-hidden className="space-y-3.5 rounded-[28px] border-[1.5px] border-[#f6c7d9] p-2">
        <div className="mx-1 mt-1.5 h-7 w-64 animate-pulse rounded-full bg-[#fdf0f6]" />
        <div className="h-[140px] animate-pulse rounded-[20px] bg-zinc-200" />
        <div className="h-[47px] animate-pulse rounded-lg bg-[#fff4f8]" />
        <div className="h-[200px] animate-pulse rounded-[20px] bg-[#fdf0f6]" />
      </div>
    </Container>
  );
}

export default function ShareLandingPage({ params }: PageProps<"/s/[code]">) {
  return (
    <>
      {/* Figma "C — One ticket": brand-only header, no footer. */}
      <Header minimal />
      <main className="flex-1">
        <Suspense fallback={<LandingSkeleton />}>
          <Landing params={params} />
        </Suspense>
      </main>
    </>
  );
}
