import { Heart, Cake, Flower2, GraduationCap, Wine, MessageCircle, Mail } from "lucide-react";

export const metadata = {
  title: "About KORA",
  description:
    "KORA was created to help you show up to every special occasion feeling confident and beautifully dressed — without the need to buy a new dress for every moment.",
};

const OCCASIONS = [
  { icon: Heart, label: "Weddings" },
  { icon: Cake, label: "Birthdays" },
  { icon: Flower2, label: "Bridal Showers" },
  { icon: GraduationCap, label: "Graduations" },
  { icon: Wine, label: "Date Nights" },
];

export default function AboutPage() {
  return (
    <div className="w-full">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section
        className="relative w-full min-h-[360px] sm:min-h-[440px] flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: "url('/images/about/hero.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Subtle dark overlay for legibility */}
        <div className="absolute inset-0 bg-black/25" />

        <div className="relative z-10 max-w-[820px] mx-auto px-6 sm:px-10 text-center">
          <h1 className="font-serif text-[22px] sm:text-[28px] leading-[1.45] text-white font-normal tracking-[0.005em]">
            KORA <span className="font-normal">was created to help you show up to</span>{" "}
            <em className="italic">every special occasion</em>{" "}
            <span>feeling</span> <em className="italic">confident</em>{" "}
            <span>and</span> <em className="italic">beautifully dressed</em>{" "}
            <span>without the need to buy a new dress for</span>{" "}
            <em className="italic">every moment</em>
          </h1>
        </div>
      </section>

      {/* ── For the girl with a full calendar ────────────────────── */}
      <section className="w-full bg-store-bg py-20 sm:py-24 px-6">
        <div className="max-w-[1200px] mx-auto text-center">
          <h2 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[0.01em] text-store-fg leading-tight mb-3">
            For the girl with a full calendar
          </h2>
          <p className="text-[13px] text-store-fg-muted mb-14">
            Because the best pieces deserve more than one story 🤍
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-12">
            {OCCASIONS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-4">
                <Icon
                  className="w-10 h-10 text-store-accent"
                  strokeWidth={1}
                  absoluteStrokeWidth
                />
                <span className="text-[12.5px] text-store-fg tracking-wide">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Showroom ─────────────────────────────────────────────── */}
      <section className="w-full bg-store-bg pb-20 sm:pb-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div
            className="relative w-full aspect-[1400/440] overflow-hidden bg-[#E2E0D6] mb-14"
            style={{
              backgroundImage: "url('/images/about/showroom.jpg')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
            role="img"
            aria-label="KORA showroom on Jl. Darmawangsa VI"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8 text-center sm:text-left">
            <h3 className="font-serif text-[26px] sm:text-[30px] text-store-fg font-normal leading-tight">
              Showroom
              <br />
              Location
            </h3>

            <div>
              <p className="font-serif text-[17px] text-store-fg mb-2">KORA (Level 4)</p>
              <p className="text-[12.5px] text-store-fg-muted leading-relaxed">
                Jl. Darmawangsa VI No. 42 Pulo,
                <br />
                Kebayoran Baru, South Jakarta 12160
              </p>
            </div>

            <div>
              <p className="font-serif text-[17px] text-store-fg mb-2">Working Hours</p>
              <p className="text-[12.5px] text-store-fg-muted leading-relaxed">
                Monday–Friday: 10 AM – 5 PM
                <br />
                Saturday: 10 AM – 1 PM
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact Us ───────────────────────────────────────────── */}
      <section className="w-full bg-sand py-20 sm:py-24 px-6">
        <div className="max-w-[1100px] mx-auto text-center">
          <h2 className="font-serif text-[30px] sm:text-[38px] text-store-fg mb-3 font-normal">
            Contact Us
          </h2>
          <p className="text-[12.5px] text-store-fg-muted mb-14 max-w-md mx-auto leading-relaxed">
            Have a question or need help with a booking? Message us on WhatsApp — we&apos;re happy to help.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-14">
            {/* WhatsApp */}
            <div className="flex flex-col items-center gap-4">
              <MessageCircle
                className="w-9 h-9 text-store-fg"
                strokeWidth={1.2}
                absoluteStrokeWidth
              />
              <p className="font-serif text-[17px] text-store-fg">Whatsapp</p>
              <div className="text-[12px] text-store-fg-muted leading-relaxed space-y-1">
                <p>
                  Admin 1 (Sheha):{" "}
                  <a
                    href="https://wa.me/62895623440010"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-store-fg underline underline-offset-2"
                  >
                    +62 895-6234-40010
                  </a>
                </p>
                <p>
                  Admin 2 (Dilla):{" "}
                  <a
                    href="https://wa.me/6289531860386"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-store-fg underline underline-offset-2"
                  >
                    +62 895-3186-0386
                  </a>
                </p>
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col items-center gap-4">
              <Mail className="w-9 h-9 text-store-fg" strokeWidth={1.2} absoluteStrokeWidth />
              <p className="font-serif text-[17px] text-store-fg">Email</p>
              <a
                href="mailto:daysinkora@gmail.com"
                className="text-[12px] text-store-fg-muted underline underline-offset-2 hover:text-store-fg"
              >
                daysinkora@gmail.com
              </a>
            </div>

            {/* Instagram */}
            <div className="flex flex-col items-center gap-4">
              <svg
                className="w-9 h-9 text-store-fg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
              <p className="font-serif text-[17px] text-store-fg">Instagram</p>
              <a
                href="https://instagram.com/daysinkora"
                target="_blank"
                rel="noreferrer"
                className="text-[12px] text-store-fg-muted underline underline-offset-2 hover:text-store-fg"
              >
                @daysinkora
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
