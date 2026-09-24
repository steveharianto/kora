"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * FAQ items.
 * Answer #1 is verbatim from the Figma.
 * Answers #2–#6 are drafted from the T&C content — TODO: confirm copy with Daphne.
 */
const FAQS = [
  {
    q: "How does renting work?",
    a: "Browse, pick your dress and event date, and check out. It arrives clean the day before your event. Wear it, then send it back within your return window — cleaning's on us.",
  },
  {
    q: "Does booking a fitting reserve the dress?",
    a: "No. A fitting lets you try the dress on, but it doesn't reserve it. The dress is only secured once payment is complete — if someone books your dates first, it's theirs.",
  },
  {
    q: "What if the dress doesn't fit on my event day?",
    a: "Please contact us as soon as you notice any fit issue. While we can't guarantee a same-day swap, we'll do our best to help based on what's available in your size.",
  },
  {
    q: "My event got moved. Can I change my rental dates?",
    a: "Yes, as long as your dress hasn't been dispatched yet. Contact us as early as possible — date changes are subject to availability and can't be made once your dress is on its way.",
  },
  {
    q: "What if I return late?",
    a: "A daily late fee applies and doubles each additional day. See the Late Returns table above for the starting rate based on your rental price. If the dress isn't returned within seven days of the deadline, we may treat it as lost.",
  },
  {
    q: "What counts as damage?",
    a: "Normal, reasonable wear is expected and never charged. Beyond that — stains, tears, burns, or alterations — may be deducted from your deposit, up to the cost of repair or replacement.",
  },
];

export default function FaqAccordion() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div>
      {FAQS.map((item, idx) => {
        const isOpen = openIdx === idx;
        return (
          <div key={idx} className="border-b border-store-fg/20 last:border-b-0">
            <button
              type="button"
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              className="w-full flex items-start gap-6 py-6 text-left cursor-pointer group"
              aria-expanded={isOpen}
            >
              <span className="font-serif text-[14px] text-store-fg-muted flex-shrink-0 w-6 pt-0.5">
                {idx + 1}.
              </span>
              <span className="flex-1 font-serif text-[16px] sm:text-[17px] text-store-fg leading-snug group-hover:text-store-accent transition-colors">
                {item.q}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-store-fg-muted flex-shrink-0 mt-1.5 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
                strokeWidth={1.5}
                absoluteStrokeWidth
              />
            </button>

            {isOpen && (
              <div className="pl-12 pr-10 pb-6 -mt-1">
                <p className="text-[12.5px] text-store-fg-muted leading-relaxed">
                  {item.a}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
