// Pure presentational full-screen loader. Shared by (storefront)/loading.tsx
// (server fallback during RSC fetch) and PageLoader (client gate while
// images load) so the two overlays are byte-identical — the user never
// sees a visual seam when one hands off to the other.
//
// `fixed inset-0` intentionally covers the header + footer so the whole
// screen is replaced, not just the content slot.

export default function LoaderShell() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#ECEBE4]"
    >
      <div className="flex flex-col items-center gap-4">
        <span
          aria-hidden
          className="w-8 h-8 border-2 border-[#64765B] border-t-transparent rounded-full animate-spin"
        />
        <p className="text-[10.5px] tracking-[0.28em] uppercase text-[#6A7563]">
          Loading
        </p>
      </div>
    </div>
  );
}
