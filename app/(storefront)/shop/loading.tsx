// Shop-specific skeleton — matches the real catalog grid so the page
// feels like it's already there when data resolves.

export default function ShopLoading() {
  return (
    <div className="w-full bg-[#ECEBE4]">
      <div className="max-w-[1512px] mx-auto px-6 sm:px-12 py-10 sm:py-14">
        {/* Heading */}
        <div className="mb-8 space-y-3">
          <div className="h-9 w-60 sm:h-11 sm:w-72 bg-[#E2E0D6] animate-pulse" />
          <div className="h-3.5 w-64 sm:w-80 bg-[#E2E0D6] animate-pulse" />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div className="space-y-4">
            <div className="h-11 w-64 bg-[#E2E0D6] animate-pulse" />
            <div className="h-11 w-72 bg-[#E2E0D6] animate-pulse" />
          </div>
          <div className="h-4 w-40 bg-[#E2E0D6] animate-pulse" />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[3/4] w-full bg-[#E2E0D6] animate-pulse mb-3" />
              <div className="h-4 w-3/4 bg-[#E2E0D6] animate-pulse mb-2" />
              <div className="h-3 w-1/3 bg-[#E2E0D6] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
