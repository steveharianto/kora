import {
  CalendarX,
  CalendarDays,
  Truck,
  Sparkles,
  PackageCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import FaqAccordion from "./FaqAccordion";

export const metadata = {
  title: "How to Rent | KORA",
  description:
    "Designer dresses, five simple steps. Learn how renting from KORA works — from booking to return.",
};

const STEPS = [
  {
    n: 1,
    icon: CalendarX,
    title: "Browse & Pick your Date",
    body: "Find your dress and choose your event date. Optionally, book a showroom fitting first.",
  },
  {
    n: 2,
    icon: CalendarDays,
    title: "Book & Pay",
    body: "Your dress is secured once payment is made. A fitting alone doesn't reserve it.",
  },
  {
    n: 3,
    icon: Truck,
    title: "It Arrives",
    body: "Your dress arrives clean and ready, one day before your event.",
  },
  {
    n: 4,
    icon: Sparkles,
    title: "Wear It",
    body: "Enjoy your moment. Turn heads.",
  },
  {
    n: 5,
    icon: PackageCheck,
    title: "Return It",
    body: "Send it back within your return window. We'll handle the cleaning.",
  },
];

const FALLBACK_DEPOSIT_TIERS = [
  { price_up_to: 1_000_000, deposit_value: 150_000 },
  { price_up_to: 1_500_000, deposit_value: 250_000 },
  { price_up_to: 2_000_000, deposit_value: 350_000 },
  { price_up_to: 99_999_999, deposit_value: 500_000 },
];
const FALLBACK_LATE_FEES = [
  { label: "Under Rp 500.000", fee: 100_000 },
  { label: "Rp 500.000 – 1.000.000", fee: 140_000 },
  { label: "Rp 1.000.000 – 2.000.000", fee: 200_000 },
  { label: "Over Rp 2.000.000", fee: 400_000 },
];

function fmt(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}
function fmtShort(n: number) {
  return n.toLocaleString("id-ID");
}

export default async function HowToRentPage() {
  const supabase = await createClient();

  const [tiersRes, rulesRes] = await Promise.all([
    supabase
      .from("deposit_tiers")
      .select("price_up_to, deposit_value")
      .order("price_up_to", { ascending: true }),
    supabase.from("app_settings").select("value").eq("key", "rental_rules").single(),
  ]);

  const tiers =
    tiersRes.data && tiersRes.data.length > 0
      ? tiersRes.data.map((t: any) => ({
          price_up_to: Number(t.price_up_to),
          deposit_value: Number(t.deposit_value),
        }))
      : FALLBACK_DEPOSIT_TIERS;

  const lateFees: { label: string; fee: number }[] =
    (rulesRes.data?.value?.late_fee_schedule as any[] | undefined)?.length
      ? rulesRes.data!.value.late_fee_schedule.map((r: any) => ({
          label: String(r.label),
          fee: Number(r.fee),
        }))
      : FALLBACK_LATE_FEES;

  const depositRows = tiers.map((t, i) => {
    if (i === 0) return [`Under Rp ${fmtShort(t.price_up_to)}`, fmt(t.deposit_value)];
    if (i === tiers.length - 1) {
      const prev = tiers[i - 1].price_up_to;
      return [`Over Rp ${fmtShort(prev)}`, fmt(t.deposit_value)];
    }
    const prev = tiers[i - 1].price_up_to;
    return [`Rp ${fmtShort(prev)} – Rp ${fmtShort(t.price_up_to)}`, fmt(t.deposit_value)];
  });

  return (
    <div className="w-full bg-store-bg">
      {/* ── 1. Rental Process ──────────────────────────────────── */}
      <section className="max-w-[1512px] mx-auto px-6 sm:px-12 pt-14 sm:pt-20 pb-16">
        <div className="text-center mb-12">
          <h1 className="font-serif text-[38px] sm:text-[52px] text-store-fg font-normal tracking-[0.01em] mb-2">
            Rental Process
          </h1>
          <p className="text-[13px] text-store-fg-muted">
            Designer dresses, five simple steps
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-[1320px] mx-auto">
          {STEPS.map(({ n, icon: Icon, title, body }) => (
            <div
              key={n}
              className="bg-[#F1EFE1] border border-store-border px-5 py-8 flex flex-col items-center text-center min-h-[220px]"
            >
              <span className="w-7 h-7 flex items-center justify-center bg-store-accent text-white text-[12px] font-medium mb-5">
                {n}
              </span>
              <Icon
                className="w-8 h-8 text-store-accent mb-5"
                strokeWidth={1}
                absoluteStrokeWidth
              />
              <h3 className="text-store-accent text-[13px] tracking-[0.02em] mb-2 font-normal leading-tight">
                {title}
              </h3>
              <p className="text-store-fg-muted text-[11px] leading-[1.55]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 2. Security Deposit & Damage Policy ─────────────────── */}
      <section className="max-w-[1512px] mx-auto px-6 sm:px-12 pb-16">
        <h2 className="font-serif text-[30px] sm:text-[40px] text-store-fg text-center font-normal tracking-[0.01em] mb-10">
          Security Deposit &amp; Damage Policy
        </h2>

        <div className="max-w-[1100px] mx-auto space-y-4">
          {/* Deposit block */}
          <div className="bg-[#F1EFE1] px-6 sm:px-10 py-8 space-y-5">
            <p className="text-center text-[12.5px] text-store-fg-muted leading-relaxed">
              A refundable security deposit is required for every rental, based on the dress&apos;s rental price.
            </p>

            <Table
              headers={["Rental Price", "Deposit (per item)"]}
              rows={depositRows}
            />

            <InfoBanner>
              Your deposit will be refunded within 48 hours after we receive the dress and complete our quality check.
            </InfoBanner>

            <InfoBanner>
              Normal wear is expected and completely fine. Deductions from your deposit may apply for damage, late returns, or breaches of our Terms &amp; Conditions.
            </InfoBanner>
          </div>

          {/* Late fees block */}
          <div className="bg-[#F1EFE1] px-6 sm:px-10 py-8 space-y-5">
            <p className="text-center text-[12.5px] text-store-fg-muted leading-relaxed max-w-[820px] mx-auto">
              Late return fees are charged daily and double with each additional day. Fees will be deducted from your deposit. The starting daily rate is based on the dress&apos;s rental price:
            </p>

            <Table
              headers={["Rental Price", "First Day Late"]}
              rows={lateFees.map((r) => [r.label, fmt(r.fee)])}
            />

            <p className="text-center text-[12px] text-store-fg-muted leading-relaxed max-w-[760px] mx-auto">
              How it adds up: The fee doubles every day you&apos;re late. For a dress under Rp 500.000: Day 1 is Rp 100.000, Day 2 is Rp 200.000, Day 3 is Rp 400.000, and so on. Please return on time.
            </p>

            <InfoBanner>
              Normal wear is expected and fine. Deposits may be deducted for damage, late returns, or breaches of our Terms &amp; Conditions.
            </InfoBanner>
          </div>
        </div>
      </section>

      {/* ── 3. Cleaning & Returns ───────────────────────────────── */}
      <section className="max-w-[1320px] mx-auto px-6 sm:px-12 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-12 lg:gap-16 items-start">
          {/* Image */}
          <div
            className="relative w-full aspect-[4/3] overflow-hidden bg-[#E2E0D6]"
            style={{
              backgroundImage: "url('/images/how-to-rent/cleaning.jpg')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
            role="img"
            aria-label="Rack of KORA rental dresses on wooden hangers"
          />

          {/* Text */}
          <div className="pt-2 lg:pt-8">
            <h2 className="font-serif text-[32px] sm:text-[40px] text-store-fg font-normal tracking-[0.01em] leading-tight mb-2">
              Cleaning &amp; Returns
            </h2>
            <p className="text-[13px] text-store-fg-muted mb-10">
              How and where to return
            </p>

            <ReturnPoint
              title="Leave the cleaning to us."
              body="Your dress arrives professionally cleaned, and we take care of it again after every rental — so you never lift a finger."
            />
            <ReturnPoint
              title="Returning is easy."
              body="Send your dress back via our logistics partner before your return deadline. Share your tracking ID or drop it off — whichever works for you."
            />
            <ReturnPoint
              title="The deadline matters."
              body="Returns are due by Day 4 (the end of your booked window). Late returns are deducted from your deposit."
              last
            />
          </div>
        </div>
      </section>

      {/* ── 4. FAQ ──────────────────────────────────────────────── */}
      <section className="w-full bg-sand py-20 sm:py-24 px-6">
        <div className="max-w-[1000px] mx-auto">
          <h2 className="font-serif text-[38px] sm:text-[48px] text-store-fg text-center font-normal tracking-[0.01em] mb-14">
            FAQ
          </h2>
          <FaqAccordion />
        </div>
      </section>
    </div>
  );
}

/* ── Layout helpers ────────────────────────────────────────────────── */

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="mx-auto max-w-[720px] border border-store-border-strong bg-white/60">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="bg-white">
            {headers.map((h) => (
              <th
                key={h}
                className="border-b border-store-border-strong px-4 py-3 text-center font-semibold text-store-fg"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-3 text-center text-store-fg-muted ${
                    i < rows.length - 1 ? "border-b border-[#E5E2D4]" : ""
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#E8E4D3] px-6 py-4 max-w-[900px] mx-auto text-center">
      <p className="text-[12px] text-store-fg-muted leading-relaxed">{children}</p>
    </div>
  );
}

function ReturnPoint({
  title,
  body,
  last = false,
}: {
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <div className={`py-6 ${last ? "" : "border-b border-store-border"}`}>
      <h3 className="text-[15px] text-store-fg mb-2 font-normal">{title}</h3>
      <p className="text-[12.5px] text-store-fg-muted leading-relaxed">{body}</p>
    </div>
  );
}
