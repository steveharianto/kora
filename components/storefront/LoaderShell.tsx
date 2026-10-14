// Pure presentational full-screen loader. Shared by (storefront)/loading.tsx
// (server fallback during RSC fetch) and PageLoader (client gate while
// images load) so the two overlays are byte-identical — the user never
// sees a visual seam when one hands off to the other.
//
// Visual: the KORA monogram cropped into a circle, breathing on the
// storefront's cream canvas. The subtle ring around the circle keeps the
// edge defined on the light background without introducing a hard border.
//
// `fixed inset-0` intentionally covers the header + footer so the whole
// screen is replaced, not just the content slot.

import Image from "next/image";

export default function LoaderShell() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#ECEBE4]"
    >
      <div className="kora-loader-logo relative w-[104px] h-[104px] sm:w-[128px] sm:h-[128px] rounded-full overflow-hidden ring-1 ring-[#3e4c3a]/15 shadow-[0_8px_32px_rgba(62,76,58,0.14)]">
        <Image
          src="/kora-logo.jpg"
          alt="KORA"
          fill
          priority
          sizes="128px"
          className="object-cover"
        />
      </div>
    </div>
  );
}
