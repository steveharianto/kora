import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Terms & Conditions | KORA",
  description:
    "Rental terms, deposit and refund policy, late-fee schedule, care & damage terms, and privacy notice for renting from KORA.",
};

/* Fallbacks — used if app_settings hasn't been seeded yet. */
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

function formatRupiah(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}
function formatShort(n: number) {
  // "1.000.000" without the "Rp " prefix (used in range labels)
  return n.toLocaleString("id-ID");
}

export default async function TermsPage() {
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

  return (
    <div className="w-full bg-store-bg">
      <div className="max-w-[900px] mx-auto px-6 py-14 sm:py-20">
        {/* Title */}
        <h1 className="font-serif text-[34px] sm:text-[44px] text-store-fg text-center font-normal tracking-[0.01em] mb-6">
          Terms &amp; Conditions
        </h1>
        <p className="text-center text-[12.5px] text-store-fg-muted max-w-[640px] mx-auto leading-relaxed mb-16">
          These Terms &amp; Conditions explain how renting from KORA works, what you can expect
          from us, and what we ask of you in return. They keep things clear and fair for everyone.
          By booking, paying for, or using any KORA service, you agree to the terms below. Please
          read them before you rent.
        </p>

        <Terms>
          <Section title="Booking &amp; Payment">
            <p>
              Your booking is confirmed once the rental fee and deposit have been paid in full.
              Booking a fitting does not reserve an item, and item is only secured once payment is
              complete. If two customers want the same item for the same dates, priority will be
              given to whoever completes payment first. All payments are handled through our secure
              payment provider, and prices shown at the time of booking will apply.
            </p>
          </Section>

          <Section title="Pricing &amp; Fees">
            <p>
              The rental fee for each item is shown on its product page and covers the standard
              rental period. If you need the dress for longer, additional rental days may be booked
              at the applicable rate. Fittings booked outside our standard hours include an
              after-hours surcharge of Rp 100.000 per appointment.
            </p>
          </Section>

          <Section title="Your Rental Window">
            <p>
              Every rental runs on a standard three-day window: your dress arrives the day before
              your event, you wear it on the day, and you have a rest day to send it back — with
              the return due by the following day. In short, the dress is yours for three days,
              and the fourth day is your return deadline. Your dress must be returned, or valid
              return tracking provided, by that deadline. Once a dress is in your hands, it&apos;s
              your responsibility until we receive it back and confirm it&apos;s in good condition.
            </p>
          </Section>

          <Section title="Deposit &amp; Refunds">
            <p>Every rental includes a refundable deposit, based on the dress&apos;s rental price:</p>
            <DataTable
              headers={["Rental Price", "Deposit (per item)"]}
              rows={tiers.map((t, i) => {
                if (i === 0) return [`Under Rp ${formatShort(t.price_up_to)}`, formatRupiah(t.deposit_value)];
                if (i === tiers.length - 1) {
                  const prev = tiers[i - 1].price_up_to;
                  return [`Over Rp ${formatShort(prev)}`, formatRupiah(t.deposit_value)];
                }
                const prev = tiers[i - 1].price_up_to;
                return [
                  `Rp ${formatShort(prev)} – Rp ${formatShort(t.price_up_to)}`,
                  formatRupiah(t.deposit_value),
                ];
              })}
            />
            <p>
              We return your deposit within 2×24 hours after your dress is received and passes our
              quality check (QC). We may deduct from your deposit for late returns, damage, loss,
              or any breach of these terms. If those costs come to more than your deposit,
              you&apos;re responsible for the difference.
            </p>
          </Section>

          <Section title="Late Returns">
            <p>
              If your dress comes back after your window ends, a daily late fee applies and is
              taken from your deposit. The fee doubles for each additional day the dress is
              outstanding. Your starting daily rate depends on the dress&apos;s rental price:
            </p>
            <DataTable
              headers={["Rental Price", "First Day Late"]}
              rows={lateFees.map((r) => [r.label, formatRupiah(r.fee)])}
            />
            <p>
              For example, a dress renting under Rp 500.000 is charged Rp 100.000 on the first day
              late, Rp 200.000 on the second, and Rp 400.000 on the third, so please return on
              time. If a dress isn&apos;t returned within seven days of its deadline, we may treat
              it as lost and charge it as described below.
            </p>
          </Section>

          <Section title="Care, Damage &amp; Loss">
            <p>
              Your dress arrives professionally cleaned, and there&apos;s no need to clean it before
              returning. We take care of that. Normal, reasonable wear is completely expected and is
              never charged. Damage beyond normal wear, such as stains, tears, burns, or any
              alteration, may be deducted from your deposit, up to the full cost of repair or
              replacement. If a dress is lost, stolen, or never returned, you&apos;re responsible
              for its full retail replacement value, less any deposit held.
            </p>
          </Section>

          <Section title="Fittings">
            <p>
              Fittings are by appointment only, in private one-hour slots. Standard and after-hours
              availability is listed on our website, and after-hours appointments are subject to the
              applicable surcharge. Please note that a fitting lets you try a dress on, but it
              doesn&apos;t reserve it; the dress is only secured once payment is complete.
            </p>
          </Section>

          <Section title="Cancellations &amp; Date Changes">
            <p>
              If you need to change your rental dates, please contact us as early as possible. Date
              changes are subject to dress availability and can only be made before your dress has
              been dispatched. Once your dress is on its way, your rental dates can no longer be
              changed. Cancellation terms and any applicable refunds will be shown at the time of
              booking.
            </p>
          </Section>

          <Section title="Liability">
            <p>
              To the fullest extent permitted by law, KORA&apos;s total liability for any rental is
              limited to the rental fee you paid for that item. While a dress is in your care,
              you&apos;re responsible for it, including any claims arising from how it&apos;s used
              during your rental.
            </p>
          </Section>

          <Section title="Privacy">
            <p>
              Your privacy matters to us. This section explains what information we collect, how we
              use it, and how we keep it safe.
            </p>
            <SubSection title="What we collect">
              When you book, rent, or get in touch, we collect the information you give us, such as
              your name, contact details, delivery and return address, measurements, and payment
              information. We may also collect basic information about how you use our website, like
              the pages you visit and the items you browse, to help us improve your experience.
            </SubSection>
            <SubSection title="How we use your information">
              We use your information to process your bookings and payments, arrange delivery and
              returns, manage your deposit, and provide customer support. With your consent, we may
              also use it to send you updates, offers, and news about KORA. We use aggregated
              insights and analytics to understand how our customers shop, improve our collection
              and service, and make your experience smoother and more personal.
            </SubSection>
            <SubSection title="Sharing your information">
              We do not sell your personal information, and we do not share it with third parties
              for their own marketing. We only share what&apos;s necessary with the trusted partners
              who help us run KORA, such as our payment provider and delivery partners, and only so
              they can perform their service. We may also disclose information where required by
              law.
            </SubSection>
            <SubSection title="Keeping your information safe">
              We take reasonable steps to protect your information against loss, misuse, and
              unauthorized access, and we keep it only for as long as needed to provide our services
              or meet our legal obligations.
            </SubSection>
            <SubSection title="Your choices">
              You can ask to access, correct, or delete your personal information, or opt out of
              marketing messages at any time. To make a request, just get in touch with us using the
              details below.
            </SubSection>
            <p className="mt-6">
              By using KORA, you agree to the collection and use of your information as described here.
            </p>
          </Section>

          <Section title="Governing Law">
            <p>
              These terms are governed by the laws of the Republic of Indonesia, and any dispute
              will be handled in line with Indonesian law.
            </p>
          </Section>

          <Section title="Contact" last>
            <p>
              Have a question about these terms or your rental? Reach us at{" "}
              <a
                href="mailto:daysinkora@gmail.com"
                className="text-store-accent underline underline-offset-2 hover:text-store-accent-hover"
              >
                daysinkora@gmail.com
              </a>
            </p>
          </Section>
        </Terms>
      </div>
    </div>
  );
}

/* ── Layout primitives ──────────────────────────────────────────────── */

function Terms({ children }: { children: React.ReactNode }) {
  return <div className="space-y-12">{children}</div>;
}

function Section({
  title,
  children,
  last = false,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section>
      <h2 className="font-serif text-[24px] sm:text-[28px] text-store-fg text-center font-normal tracking-[0.01em] mb-5">
        {title}
      </h2>
      <div
        className={`text-[13px] leading-[1.75] text-store-fg-muted text-center space-y-4 ${
          last ? "" : ""
        }`}
      >
        {children}
      </div>
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-2">
      <p className="font-semibold text-store-fg mb-1">{title}</p>
      <p>{children}</p>
    </div>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="my-6 mx-auto max-w-[720px] border border-store-border-strong">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="bg-[#F1EFE1]">
            {headers.map((h) => (
              <th
                key={h}
                className="border-b border-store-border-strong px-4 py-3 text-center font-semibold text-store-fg tracking-[0.02em]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 1 ? "bg-[#F9F8F2]/60" : ""}>
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
