import { Suspense } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { HomeContent } from "@/features/offers/components/HomeContent";
import { HomeSkeleton } from "@/features/offers/components/HomeSkeleton";

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Header/footer ship in the static shell; offers stream in at request time. */}
        <Suspense fallback={<HomeSkeleton />}>
          <HomeContent />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
