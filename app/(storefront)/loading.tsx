// Top-level storefront loading state — shown during any server-component
// fetch inside the (storefront) group, except where a nested route
// provides its own loading.tsx (e.g. /shop).
//
// Header/footer stay mounted because this file is a child of the layout;
// only the content area is replaced.

export default function StorefrontLoading() {
  return (
    <div className="w-full bg-[#ECEBE4] min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <span
          aria-hidden
          className="w-8 h-8 border-2 border-[#64765B] border-t-transparent rounded-full animate-spin"
        />
        <p className="text-[11px] tracking-[0.24em] uppercase text-[#6A7563]">
          Loading
        </p>
      </div>
    </div>
  );
}
