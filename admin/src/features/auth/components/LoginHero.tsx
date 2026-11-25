import Image from "next/image";

/** Left half of the admin sign-in screen — Figma "Brand panel" (node 235:479). */
export function LoginHero() {
  return (
    <section
      className="relative hidden overflow-hidden p-16 text-white lg:flex lg:flex-col lg:justify-between"
      style={{ backgroundImage: "linear-gradient(128.66deg, #e2136e 14.64%, #800038 85.36%)" }}
    >
      {/* Decor circles (positions from the 720×900 Figma panel; right-anchored ones stay put). */}
      <Image
        src="/images/icons/decor-circle-1.svg"
        alt=""
        aria-hidden
        width={520}
        height={520}
        unoptimized
        className="pointer-events-none absolute top-[-160px] right-[-220px] max-w-none"
      />
      <Image
        src="/images/icons/decor-circle-2.svg"
        alt=""
        aria-hidden
        width={420}
        height={420}
        unoptimized
        className="pointer-events-none absolute top-[560px] left-[-140px] max-w-none"
      />
      <Image
        src="/images/icons/decor-circle-3.svg"
        alt=""
        aria-hidden
        width={260}
        height={260}
        unoptimized
        className="pointer-events-none absolute top-[520px] right-[-60px] max-w-none"
      />

      {/* Logo */}
      <div className="relative flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-white">
          <Image
            src="/images/icons/gift.svg"
            alt=""
            aria-hidden
            width={24}
            height={24}
            unoptimized
          />
        </span>
        <span className="text-[22px] leading-[normal] font-semibold">Mnemonic</span>
        <span className="rounded-full border border-white/24 bg-white/18 px-2.5 py-1 text-xs leading-[normal] font-semibold">
          Admin
        </span>
      </div>

      <h1 className="relative w-full max-w-[560px] text-[44px] leading-[52px] font-extrabold">
        Share Offers, Win Prizes — managed in one place.
      </h1>

      <p className="relative text-xs leading-[normal] text-white/75">
        © 2026 bKash. All rights reserved.
      </p>
    </section>
  );
}
