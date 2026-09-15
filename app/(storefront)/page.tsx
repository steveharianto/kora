import Link from 'next/link';

export default function StorefrontHomePage() {
  const featuredDresses = [
    {
      sku: 'ZM19',
      name: 'Zimmermann Super Eight Ruffle Maxi',
      price: 'Rp. 1.700.000',
      image: '/images/home/featured-1.jpg',
    },
    {
      sku: 'ZM19',
      name: 'Zimmermann Super Eight Ruffle Maxi',
      price: 'Rp. 1.700.000',
      image: '/images/home/featured-2.jpg',
    },
    {
      sku: 'ZM19',
      name: 'Zimmermann Super Eight Ruffle Maxi',
      price: 'Rp. 1.700.000',
      image: '/images/home/featured-3.jpg',
    },
  ];

  return (
    <div className="w-full flex flex-col">
      {/* =================================================================== */}
      {/* SECTION 1: HERO CAROUSEL BANNER                                     */}
      {/* =================================================================== */}
      <section className="relative w-full h-[540px] sm:h-[620px] flex items-center justify-center overflow-hidden">
        {/* Background Banner with Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(0deg, rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.25)), url('/images/home/hero-1.jpg')`,
          }}
        />

        {/* Hero Content */}
        <div className="relative z-10 text-center text-white px-4">
          <h1 className="font-serif text-[42px] sm:text-[62px] font-normal tracking-[0.02em] mb-4 text-[#FBF9F5] drop-shadow-sm">
            New Arrivals
          </h1>
          <Link
            href="/shop"
            className="inline-block bg-[#ECEBE4] text-[#1F261C] px-8 py-2.5 text-[11px] uppercase tracking-[0.2em] font-semibold hover:bg-white transition-all shadow-md"
          >
            Shop Now
          </Link>
        </div>

        {/* Slide Indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          <span className="w-2 h-2 rounded-full bg-white" />
          <span className="w-2 h-2 rounded-full bg-white/40" />
          <span className="w-2 h-2 rounded-full bg-white/40" />
        </div>

        {/* Navigation Arrows */}
        <button
          type="button"
          aria-label="Previous Slide"
          className="absolute left-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-2xl hidden sm:block z-10"
        >
          ←
        </button>
        <button
          type="button"
          aria-label="Next Slide"
          className="absolute right-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-2xl hidden sm:block z-10"
        >
          →
        </button>
      </section>

      {/* =================================================================== */}
      {/* SECTION 2: "RENT ME ONCE, HEAD BE TURNING TWICE!"                   */}
      {/* =================================================================== */}
      <section className="max-w-[1512px] mx-auto w-full py-20 sm:py-24 px-6 sm:px-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <h2 className="font-serif text-[28px] sm:text-[36px] font-normal tracking-[0.01em] text-[#2D3828] mb-2">
              Rent me once, Head be turning Twice!
            </h2>
            <p className="text-xs text-[#6A7563] max-w-xl">
              Romanticize your life with high-quality designer pieces — for a fraction of the price. Leave the commitment to us.
            </p>
          </div>

          <Link
            href="/shop"
            className="self-start md:self-auto bg-[#64765B] text-white px-5 py-2.5 text-[10.5px] uppercase tracking-[0.16em] font-medium hover:bg-[#52624B] transition-colors"
          >
            See All Collection
          </Link>
        </div>

        {/* Featured 3-Card Showcase */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {featuredDresses.map((dress, index) => (
            <Link
              key={index}
              href={`/shop/${dress.sku.toLowerCase()}`}
              className="group flex flex-col"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#E2E0D6] mb-3">
                <div
                  className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-700"
                  style={{ backgroundImage: `url('${dress.image}')` }}
                />
              </div>
              <h3 className="font-serif text-[15px] text-[#242A20] group-hover:text-[#64765B] transition-colors line-clamp-1 font-normal">
                {dress.sku}-{dress.name}
              </h3>
              <p className="text-xs font-mono text-[#54644C] mt-0.5">
                {dress.price}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* =================================================================== */}
      {/* SECTION 3: EDITORIAL SPLIT SHOWCASE                                 */}
      {/* =================================================================== */}
      <section className="relative w-full min-h-[580px] sm:min-h-[720px] bg-[#2E362A] text-white overflow-hidden flex items-center">
        {/* Editorial Background Composition */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35"
          style={{ backgroundImage: `url('/images/home/editorial-bg.jpg')` }}
        />

        <div className="relative z-10 max-w-[1512px] mx-auto w-full px-6 sm:px-12 py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Text */}
          <div className="lg:col-span-4 text-center lg:text-left space-y-2">
            <h2 className="font-serif text-[36px] sm:text-[48px] font-normal tracking-[0.02em] text-[#F3F1EC]">
              New Arrivals
            </h2>
            <p className="text-xs tracking-wider text-[#DCD8CC] uppercase">
              Fresh in, ready to rent
            </p>
          </div>

          {/* Center Showcase Image */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-[360px] aspect-[3/4] bg-[#424D3D] shadow-2xl overflow-hidden border border-white/10">
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url('/images/home/editorial-center.jpg')` }}
              />
            </div>
          </div>

          {/* Right Action Trigger */}
          <div className="lg:col-span-3 flex justify-center lg:justify-end">
            <Link
              href="/shop"
              className="bg-[#ECEBE4] text-[#1F261C] px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-white transition-colors shadow-lg"
            >
              See What&apos;s New
            </Link>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* SECTION 4: "AVAILABLE THIS WEEK"                                    */}
      {/* =================================================================== */}
      <section className="w-full py-24 sm:py-28 px-6 bg-[#F2F0E9] flex flex-col items-center text-center">
        <div className="max-w-[420px] w-full mb-8">
          <div className="relative aspect-[3/4] w-full overflow-hidden shadow-lg bg-[#E2E0D6] border border-[#DDD9CE]">
            <div
              className="w-full h-full bg-cover bg-center"
              style={{ backgroundImage: `url('/images/home/available-week.jpg')` }}
            />
          </div>
        </div>

        <h2 className="font-serif text-[32px] sm:text-[40px] font-normal tracking-[0.01em] text-[#2D3828] mb-2">
          Available This Week
        </h2>
        <p className="text-xs text-[#6A7563] max-w-sm mb-6">
          Got an event coming up? These pieces are ready for you.
        </p>
        <Link
          href="/shop?filter=available-now"
          className="bg-[#64765B] text-white px-9 py-2.5 text-[11px] uppercase tracking-[0.18em] font-medium hover:bg-[#52624B] transition-colors"
        >
          Rent Now
        </Link>
      </section>

      {/* =================================================================== */}
      {/* SECTION 5: "HOW IT WORKS" — 4 SIMPLE STEPS                          */}
      {/* =================================================================== */}
      <section className="w-full py-24 sm:py-28 px-6 bg-[#DDDBCF] border-t border-[#CECBC0] flex flex-col items-center">
        <div className="text-center mb-16">
          <h2 className="font-serif text-[36px] sm:text-[46px] font-normal tracking-[0.01em] text-[#364230] mb-2">
            How It Works
          </h2>
          <p className="text-xs tracking-wider text-[#5D6B56] uppercase">
            Designer dresses, four simple steps
          </p>
        </div>

        {/* 4 Connected Circular Steps */}
        <div className="max-w-[1280px] w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative mb-16">
          {/* Step 1 */}
          <div className="flex flex-col items-center text-center group">
            <div className="w-40 h-40 rounded-full border border-[#7A8B73] bg-[#E5E3D8] flex flex-col items-center justify-center p-4 mb-4 shadow-sm group-hover:bg-[#ECEAE0] transition-colors">
              <svg
                className="w-8 h-8 stroke-[#485642] fill-none stroke-[1.4] mb-1"
                viewBox="0 0 24 24"
              >
                <rect x="3" y="4" width="18" height="16" rx="1" />
                <path d="M7 8h10M7 12h4" />
              </svg>
              <h3 className="font-serif text-[17px] text-[#2D3828] font-normal">
                Browse
              </h3>
            </div>
            <p className="text-xs text-[#5D6B56] max-w-[180px]">
              Find the one for your occasion
            </p>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center text-center group">
            <div className="w-40 h-40 rounded-full border border-[#7A8B73] bg-[#E5E3D8] flex flex-col items-center justify-center p-4 mb-4 shadow-sm group-hover:bg-[#ECEAE0] transition-colors">
              <svg
                className="w-8 h-8 stroke-[#485642] fill-none stroke-[1.4] mb-1"
                viewBox="0 0 24 24"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <h3 className="font-serif text-[17px] text-[#2D3828] font-normal">
                Book Your Dates
              </h3>
            </div>
            <p className="text-xs text-[#5D6B56] max-w-[180px]">
              Pick when you need it. We&apos;ll have it ready
            </p>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center text-center group">
            <div className="w-40 h-40 rounded-full border border-[#7A8B73] bg-[#E5E3D8] flex flex-col items-center justify-center p-4 mb-4 shadow-sm group-hover:bg-[#ECEAE0] transition-colors">
              <svg
                className="w-8 h-8 stroke-[#485642] fill-none stroke-[1.4] mb-1"
                viewBox="0 0 24 24"
              >
                <path d="M12 2l2.5 5 5 .5-4 3.5 1.5 5.5-5-3-5 3 1.5-5.5-4-3.5 5-.5z" />
              </svg>
              <h3 className="font-serif text-[17px] text-[#2D3828] font-normal">
                Wear It
              </h3>
            </div>
            <p className="text-xs text-[#5D6B56] max-w-[180px]">
              Show up, turn heads, enjoy the night
            </p>
          </div>

          {/* Step 4 */}
          <div className="flex flex-col items-center text-center group">
            <div className="w-40 h-40 rounded-full border border-[#7A8B73] bg-[#E5E3D8] flex flex-col items-center justify-center p-4 mb-4 shadow-sm group-hover:bg-[#ECEAE0] transition-colors">
              <svg
                className="w-8 h-8 stroke-[#485642] fill-none stroke-[1.4] mb-1"
                viewBox="0 0 24 24"
              >
                <path d="M21 8H3v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8zM16 4l-4 4-4-4" />
              </svg>
              <h3 className="font-serif text-[17px] text-[#2D3828] font-normal">
                Return It
              </h3>
            </div>
            <p className="text-xs text-[#5D6B56] max-w-[180px]">
              Send it back. We handle the cleaning
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <Link
          href="/how-to-rent"
          className="bg-[#64765B] text-white px-8 py-3 text-[11px] uppercase tracking-[0.18em] font-medium hover:bg-[#52624B] transition-colors shadow-sm"
        >
          Learn How To Rent
        </Link>
      </section>
    </div>
  );
}
