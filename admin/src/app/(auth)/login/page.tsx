import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { LoginHero } from "@/features/auth/components/LoginHero";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh bg-white lg:grid-cols-2">
      <LoginHero />
      <section className="flex items-center justify-center px-6 py-12">
        {/* useSearchParams (post-login redirect) needs a Suspense boundary. */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
