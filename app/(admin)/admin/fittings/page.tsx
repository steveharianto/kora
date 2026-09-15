import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/utils";
import { Plus } from "lucide-react";

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("T")[0].split("-");
  if (!year || !month || !day) return "—";
  return `${day}/${month}/${year}`;
}

export default async function FittingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    status?: string;
  }>;
}) {
  const resolvedParams = await searchParams;
  const currentTab = resolvedParams.tab || "schedule";
  const searchQuery = (resolvedParams.search || "").trim().toLowerCase();
  const statusFilter = resolvedParams.status || "all";

  const supabase = await createClient();

  const { data: rawFittings } = await supabase
    .from("fittings")
    .select(
      `
      *,
      customers (
        id,
        first_name,
        last_name,
        phone
      ),
      fitting_items (
        item_sku,
        is_evicted,
        items (
          name
        )
      )
    `,
    )
    .order("date", { ascending: true })
    .order("slot", { ascending: true });

  const allFittings = (rawFittings || []).map((f: any) => {
    const custName =
      `${f.customers?.first_name || ""} ${f.customers?.last_name || ""}`.trim() ||
      "Customer";
    const totalItems = (f.fitting_items || []).length;
    const itemsSummary = (f.fitting_items || [])
      .map((fi: any) =>
        fi.is_evicted ? `${fi.item_sku} (Evicted)` : fi.item_sku,
      )
      .join(", ");

    return {
      ...f,
      customerName: custName,
      itemsFormatted: itemsSummary
        ? `${itemsSummary} (${totalItems}/3)`
        : "0/3",
      slotFormatted: f.slot ? f.slot.slice(0, 5) : "—",
    };
  });

  const now = new Date();
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(now);

  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(tomorrowDate);

  const overdueSessions = allFittings.filter(
    (f) =>
      f.date < todayStr &&
      !["Completed", "Cancelled", "Conflict Evicted", "No Show"].includes(
        f.status,
      ),
  );
  const todaySessions = allFittings.filter((f) => f.date === todayStr);
  const tomorrowSessions = allFittings.filter((f) => f.date === tomorrowStr);
  const upcomingSessions = allFittings.filter((f) => f.date > tomorrowStr);

  let filtered = allFittings;
  if (searchQuery) {
    filtered = filtered.filter(
      (f) =>
        f.id.toLowerCase().includes(searchQuery) ||
        f.customerName.toLowerCase().includes(searchQuery) ||
        f.itemsFormatted.toLowerCase().includes(searchQuery),
    );
  }
  if (statusFilter !== "all") {
    filtered = filtered.filter(
      (f) => f.status.toLowerCase() === statusFilter.toLowerCase(),
    );
  }

  return (
    <div className="max-w-[1250px] mx-auto pb-24 font-sans text-ink">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1 font-medium">
            Operations
          </div>
          <h1 className="font-serif text-[32px] font-normal tracking-[0.01em] text-ink">
            Fittings
          </h1>
        </div>

        <Link
          href="/admin/fittings/new"
          className="px-4 py-2 bg-[#1A1F16] text-white rounded-lg text-xs font-semibold hover:bg-black transition flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />+ Create Fitting Session
        </Link>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-5 border-b border-line mb-6">
        <Link
          href="?tab=schedule"
          className={`pb-2.5 text-sm font-medium transition-colors ${
            currentTab === "schedule"
              ? "text-wine-ink border-b-2 border-wine"
              : "text-muted hover:text-ink"
          }`}
        >
          Schedule
        </Link>
        <Link
          href="?tab=all"
          className={`pb-2.5 text-sm font-medium transition-colors ${
            currentTab === "all"
              ? "text-wine-ink border-b-2 border-wine"
              : "text-muted hover:text-ink"
          }`}
        >
          All sessions
        </Link>
      </div>

      {/* TAB 1: SCHEDULE */}
      {currentTab === "schedule" && (
        <div className="space-y-7">
          {/* OVERDUE */}
          {overdueSessions.length > 0 && (
            <div>
              <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#A63222] mb-2.5">
                OVERDUE / ACTION NEEDED — {overdueSessions.length}
              </div>

              <div className="bg-card border border-[#E8C0B9] rounded-[10px] p-2 pb-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <div className="w-full overflow-x-auto">
                  <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[850px]">
                    <thead>
                      <tr className="border-b border-line text-[10px] tracking-[0.14em] uppercase text-muted text-left font-medium">
                        <th className="px-3 py-2.5">Booking</th>
                        <th className="px-3 py-2.5">Customer</th>
                        <th className="px-3 py-2.5">Items (Max 3)</th>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Slot</th>
                        <th className="px-3 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdueSessions.map((s) => (
                        <tr
                          key={s.id}
                          className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none"
                        >
                          <td className="px-3 py-3 font-bold text-ink">
                            <Link href={`/admin/fittings/${s.id}`} className="hover:underline text-wine-ink hover:text-black">
                              {s.id}
                            </Link>
                          </td>
                          <td className="px-3 py-3 font-medium">
                            {s.customerName}
                          </td>
                          <td className="px-3 py-3 font-mono text-xs">
                            {s.itemsFormatted}
                          </td>
                          <td className="px-3 py-3 text-[#A63222] font-semibold">
                            {formatDate(s.date)}
                          </td>
                          <td className="px-3 py-3">{s.slotFormatted}</td>
                          <td className="px-3 py-3">
                            <span className="bg-[#FBEBE8] text-[#A63222] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-[#E8C0B9]">
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TODAY */}
          <div>
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-muted mb-2.5">
              TODAY · {todayStr} — {todaySessions.length}
            </div>

            <div className="bg-card border border-line rounded-[10px] p-2 pb-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[850px]">
                  <thead>
                    <tr className="border-b border-line text-[10px] tracking-[0.14em] uppercase text-muted text-left font-medium">
                      <th className="px-3 py-2.5">Booking</th>
                      <th className="px-3 py-2.5">Customer</th>
                      <th className="px-3 py-2.5">Items (Max 3)</th>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Slot</th>
                      <th className="px-3 py-2.5">After Hours</th>
                      <th className="px-3 py-2.5">Reminder</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todaySessions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-3 py-6 text-center text-muted text-xs"
                        >
                          No fitting sessions scheduled for today.
                        </td>
                      </tr>
                    ) : (
                      todaySessions.map((s) => (
                        <tr
                          key={s.id}
                          className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none"
                        >
                          <td className="px-3 py-3 font-bold text-ink">
                            <Link href={`/admin/fittings/${s.id}`} className="hover:underline text-wine-ink hover:text-black">
                              {s.id}
                            </Link>
                          </td>
                          <td className="px-3 py-3 font-medium">
                            {s.customerName}
                          </td>
                          <td className="px-3 py-3 font-mono text-xs">
                            {s.itemsFormatted}
                          </td>
                          <td className="px-3 py-3 text-muted">
                            {formatDate(s.date)}
                          </td>
                          <td className="px-3 py-3 font-medium">
                            {s.slotFormatted}
                          </td>
                          <td className="px-3 py-3 text-muted">
                            {s.is_after_hours
                              ? formatRupiah(Number(s.after_hours_fee))
                              : "—"}
                          </td>
                          <td className="px-3 py-3 text-muted text-xs">
                            {s.reminder_sent_at ? "Sent" : "—"}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${
                                s.status === "Confirmed"
                                  ? "bg-[#EAF3E7] text-[#2E7D47] border-[#CAD3C5]"
                                  : s.status === "Pending"
                                    ? "bg-[#FDF3DE] text-[#977028] border-[#F1DFB7]"
                                    : s.status === "Conflict Evicted"
                                      ? "bg-[#F8EED9] text-[#A65B20] border-[#E8DFC2]"
                                      : "bg-[#EFEBE2] text-muted border-transparent"
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* TOMORROW */}
          <div>
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-muted mb-2.5">
              TOMORROW · {tomorrowStr} — SEND REMINDERS — {tomorrowSessions.length}
            </div>

            <div className="bg-card border border-line rounded-[10px] p-2 pb-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[850px]">
                  <thead>
                    <tr className="border-b border-line text-[10px] tracking-[0.14em] uppercase text-muted text-left font-medium">
                      <th className="px-3 py-2.5">Booking</th>
                      <th className="px-3 py-2.5">Customer</th>
                      <th className="px-3 py-2.5">Items (Max 3)</th>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Slot</th>
                      <th className="px-3 py-2.5">After Hours</th>
                      <th className="px-3 py-2.5">Reminder</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tomorrowSessions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-3 py-6 text-center text-muted text-xs"
                        >
                          No fitting sessions scheduled for tomorrow.
                        </td>
                      </tr>
                    ) : (
                      tomorrowSessions.map((s) => (
                        <tr
                          key={s.id}
                          className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none"
                        >
                          <td className="px-3 py-3 font-bold text-ink">
                            <Link href={`/admin/fittings/${s.id}`} className="hover:underline text-wine-ink hover:text-black">
                              {s.id}
                            </Link>
                          </td>
                          <td className="px-3 py-3 font-medium">
                            {s.customerName}
                          </td>
                          <td className="px-3 py-3 font-mono text-xs">
                            {s.itemsFormatted}
                          </td>
                          <td className="px-3 py-3 text-muted">
                            {formatDate(s.date)}
                          </td>
                          <td className="px-3 py-3 font-medium">
                            {s.slotFormatted}
                          </td>
                          <td className="px-3 py-3 text-muted">
                            {s.is_after_hours
                              ? formatRupiah(Number(s.after_hours_fee))
                              : "—"}
                          </td>
                          <td className="px-3 py-3">
                            {!s.reminder_sent_at ? (
                              <span className="bg-[#FDF3DE] text-[#977028] text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-[#F1DFB7]">
                                REMINDER DUE
                              </span>
                            ) : (
                              <span className="text-xs text-muted">Sent</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${
                                s.status === "Confirmed"
                                  ? "bg-[#EAF3E7] text-[#2E7D47] border-[#CAD3C5]"
                                  : "bg-[#FDF3DE] text-[#977028] border-[#F1DFB7]"
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* UPCOMING */}
          <div>
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-muted mb-2.5">
              UPCOMING — {upcomingSessions.length}
            </div>

            <div className="bg-card border border-line rounded-[10px] p-2 pb-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[850px]">
                  <thead>
                    <tr className="border-b border-line text-[10px] tracking-[0.14em] uppercase text-muted text-left font-medium">
                      <th className="px-3 py-2.5">Booking</th>
                      <th className="px-3 py-2.5">Customer</th>
                      <th className="px-3 py-2.5">Items (Max 3)</th>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Slot</th>
                      <th className="px-3 py-2.5">After Hours</th>
                      <th className="px-3 py-2.5">Reminder</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingSessions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-3 py-6 text-center text-muted text-xs"
                        >
                          No upcoming sessions booked.
                        </td>
                      </tr>
                    ) : (
                      upcomingSessions.map((s) => (
                        <tr
                          key={s.id}
                          className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none"
                        >
                          <td className="px-3 py-3 font-bold text-ink">
                            <Link href={`/admin/fittings/${s.id}`} className="hover:underline text-wine-ink hover:text-black">
                              {s.id}
                            </Link>
                          </td>
                          <td className="px-3 py-3 font-medium">
                            {s.customerName}
                          </td>
                          <td className="px-3 py-3 font-mono text-xs">
                            {s.itemsFormatted}
                          </td>
                          <td className="px-3 py-3 font-medium text-ink">
                            {formatDate(s.date)}
                          </td>
                          <td className="px-3 py-3">{s.slotFormatted}</td>
                          <td className="px-3 py-3 font-medium text-ink">
                            {s.is_after_hours
                              ? formatRupiah(Number(s.after_hours_fee))
                              : "—"}
                          </td>
                          <td className="px-3 py-3 text-muted text-xs">—</td>
                          <td className="px-3 py-3">
                            <span
                              className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${
                                s.status === "Confirmed"
                                  ? "bg-[#EAF3E7] text-[#2E7D47] border-[#CAD3C5]"
                                  : "bg-[#FDF3DE] text-[#977028] border-[#F1DFB7]"
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALL SESSIONS */}
      {currentTab === "all" && (
        <div>
          <form
            method="GET"
            className="flex flex-wrap items-center gap-3 mb-4 text-[13px]"
          >
            <input type="hidden" name="tab" value="all" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery}
              placeholder="Search customer, ID, SKU..."
              className="px-3.5 py-1.5 w-60 rounded-lg border border-line bg-card text-ink focus:outline-none focus:ring-1 focus:ring-wine"
            />
            <select
              name="status"
              defaultValue={statusFilter}
              className="px-3 py-1.5 rounded-lg border border-line bg-card text-ink text-xs cursor-pointer"
            >
              <option value="all">Status (All) ▾</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Conflict Evicted">Conflict Evicted</option>
            </select>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg border border-line bg-card text-xs text-muted hover:text-ink hover:bg-[#F6F4EF] transition cursor-pointer"
            >
              Filter
            </button>
          </form>

          <div className="bg-card border border-line rounded-[10px] p-2 pb-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[850px]">
                <thead>
                  <tr className="border-b border-line text-[10.5px] tracking-[0.14em] uppercase text-muted text-left font-medium">
                    <th className="px-3 py-3">Booking</th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3">Items</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Slot</th>
                    <th className="px-3 py-3">Source</th>
                    <th className="px-3 py-3">After Hours</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-10 text-center text-muted"
                      >
                        No sessions match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none"
                      >
                        <td className="px-3 py-3.5 font-bold text-ink">
                          <Link href={`/admin/fittings/${s.id}`} className="hover:underline text-wine-ink hover:text-black">
                            {s.id}
                          </Link>
                        </td>
                        <td className="px-3 py-3.5 font-medium">
                          {s.customerName}
                        </td>
                        <td className="px-3 py-3.5 font-mono text-xs">
                          {s.itemsFormatted}
                        </td>
                        <td className="px-3 py-3.5 text-muted">
                          {formatDate(s.date)}
                        </td>
                        <td className="px-3 py-3.5">{s.slotFormatted}</td>
                        <td className="px-3 py-3.5 text-xs text-muted">
                          {s.source}
                        </td>
                        <td className="px-3 py-3.5 text-xs">
                          {s.is_after_hours
                            ? formatRupiah(Number(s.after_hours_fee))
                            : "—"}
                        </td>
                        <td className="px-3 py-3.5">
                          <span
                            className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${
                              s.status === "Confirmed"
                                ? "bg-[#EAF3E7] text-[#2E7D47] border-[#CAD3C5]"
                                : s.status === "Pending"
                                  ? "bg-[#FDF3DE] text-[#977028] border-[#F1DFB7]"
                                  : s.status === "Conflict Evicted"
                                    ? "bg-[#F8EED9] text-[#A65B20] border-[#E8DFC2]"
                                    : "bg-[#EFEBE2] text-muted border-transparent"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
