import Link from "next/link";
import { getCurrentAdmin } from "@/app/actions/auth";
import { getDashboardMetrics } from "@/app/actions/dashboard";
import { formatRupiah } from "@/lib/utils";
import PureSvgBarChart from "@/components/admin/dashboard/PureSvgBarChart";
import PureSvgDonut from "@/components/admin/dashboard/PureSvgDonut";
import DashboardRangeSelector from "@/components/admin/dashboard/DashboardRangeSelector";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; start?: string; end?: string }>;
}) {
  const resolvedParams = await searchParams;
  const rangeKey = resolvedParams.range || "30d";

  const [admin, metrics] = await Promise.all([
    getCurrentAdmin(),
    getDashboardMetrics(rangeKey, resolvedParams.start, resolvedParams.end),
  ]);

  const adminFirstName = admin?.name?.split(" ")[0] || "Daphne";

  return (
    <div className="pb-24 font-sans text-ink space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1 font-medium">Overview</div>
          <h1 className="font-serif text-[32px] font-normal tracking-[0.01em] text-ink">
            {metrics.greeting}, {adminFirstName}
          </h1>
          <p className="text-xs text-muted mt-0.5">{metrics.dateRangeLabel}</p>
        </div>
        <div><DashboardRangeSelector /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-line rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h3 className="font-serif text-[18px] font-normal mb-1">Revenue trend</h3>
            <p className="text-[11.5px] text-muted mb-4">
              <span className="font-semibold text-wine-ink">▲ {metrics.revenueDeltaPercent}%</span>{" "}
              vs {formatRupiah(metrics.previousRevenue)} in the previous period ({metrics.previousRangeLabel})
            </p>
          </div>
          <PureSvgBarChart data={metrics.dailyRevenueTrend} height={175} />
        </div>

        <div className="bg-card border border-line rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h3 className="font-serif text-[18px] font-normal mb-1">Top dresses by revenue</h3>
            <p className="text-[11.5px] text-muted mb-4">{metrics.topDressLeadText}</p>
          </div>
          <div className="space-y-3 font-tabular-nums text-xs">
            {metrics.topDresses.length === 0 ? (
              <p className="text-muted text-center py-8">No dress rental data recorded.</p>
            ) : (
              metrics.topDresses.map((dress, idx) => {
                const maxRevenue = metrics.topDresses[0]?.revenue || 1;
                const barWidthPercent = Math.max(8, Math.round((dress.revenue / maxRevenue) * 100));
                return (
                  <div key={idx} className="flex items-center justify-between gap-3 cursor-help"
                    title={`${dress.name} — ${formatRupiah(dress.revenue)} (${dress.sharePercent}% of dress revenue)`}>
                    <span className="w-32 truncate text-ink font-medium">{dress.name}</span>
                    <div className="flex-1 bg-[#F1EEE7] h-4 rounded-sm overflow-hidden flex items-center">
                      <div className="bg-[#4A7C4E] h-full rounded-sm" style={{ width: `${barWidthPercent}%` }} />
                    </div>
                    <span className="w-16 text-right text-muted font-mono">{(dress.revenue / 1000000).toFixed(1)} jt</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="bg-card border border-line rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
          <div>
            <h4 className="font-serif text-[16px] font-normal">Orders by status</h4>
            <p className="text-[11px] text-muted">
              {metrics.orderStatusBreakdown.totalOrders} order(s) —{" "}
              <span className="text-wine-ink font-semibold">▲ {metrics.orderStatusBreakdown.orderDeltaPercent}%</span> vs prev
            </p>
          </div>
          <PureSvgDonut segments={metrics.orderStatusBreakdown.segments} size={95} />
        </div>
        <div className="bg-card border border-line rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
          <div>
            <h4 className="font-serif text-[16px] font-normal">Channel split</h4>
            <p className="text-[11px] text-muted">
              Website {metrics.channelSplit.websitePercent}% —{" "}
              <span className="text-muted font-semibold">
                {metrics.channelSplit.websiteDeltaPt >= 0 ? "▲" : "▼"} {Math.abs(metrics.channelSplit.websiteDeltaPt)}pt
              </span>{" "}
              vs prev
            </p>
          </div>
          <PureSvgDonut segments={metrics.channelSplit.segments} size={95} />
        </div>
        <div className="bg-card border border-line rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
          <div>
            <h4 className="font-serif text-[16px] font-normal">New vs returning</h4>
            <p className="text-[11px] text-muted">{metrics.customerRetention.newPercent}% new customers</p>
          </div>
          <PureSvgDonut segments={metrics.customerRetention.segments} size={95} />
        </div>
      </div>

      {/* DAILY OPERATIONAL TRIAGE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Pack & dispatch */}
        <div className="bg-card border border-line rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h4 className="font-serif text-[16px] font-normal mb-3">Pack & dispatch today</h4>
            <div className="space-y-3 text-xs">
              {metrics.triage.dispatchToday.length === 0 ? (
                <p className="text-muted text-xs">No parcels due for dispatch today.</p>
              ) : (
                metrics.triage.dispatchToday.map((item) => (
                  <Link key={item.orderId} href={`/admin/orders/${item.orderId}`}
                    className="block group hover:bg-[#F6F4EF] p-1.5 -mx-1.5 rounded transition">
                    <div className="font-bold text-ink group-hover:text-wine-ink">
                      {item.orderId} · {item.customerName}
                    </div>
                    <div className="text-muted text-[11px]">{item.sku} · {item.city}</div>
                  </Link>
                ))
              )}
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-line">
            <Link href="/admin/orders" className="text-xs font-semibold text-wine-ink hover:underline">Open Orders →</Link>
          </div>
        </div>

        {/* 2. Returns due & overdue — WITH synthetic no-request rows */}
        <div className="bg-card border border-line rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h4 className="font-serif text-[16px] font-normal mb-3">Returns due & overdue</h4>
            <div className="space-y-3 text-xs">
              {metrics.triage.returnsDue.length === 0 ? (
                <p className="text-muted text-xs">No pending returns requiring action.</p>
              ) : (
                metrics.triage.returnsDue.map((item) => {
                  // Synthetic no-request row → link to order; real return → link to return detail
                  const href = item.hasRequest
                    ? `/admin/returns/${item.id}`
                    : `/admin/orders/${item.orderId}`;
                  return (
                    <Link key={item.id} href={href}
                      className="block group hover:bg-[#F6F4EF] p-1.5 -mx-1.5 rounded transition">
                      <div className="font-bold text-ink group-hover:text-wine-ink">
                        {item.orderId} · {item.customerName}
                      </div>
                      <div className="text-muted text-[11px] flex items-center gap-1.5 flex-wrap">
                        <span>{item.sku}</span>
                        <span className={`text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${
                          item.isOverdue
                            ? "bg-[#FBEBE8] text-[#A63222] border-[#E8C0B9]"
                            : "bg-[#FDF3DE] text-[#977028] border-[#F1DFB7]"
                        }`}>
                          {item.agingText}
                        </span>
                        {!item.hasRequest && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border bg-[#FBEBE8] text-[#A63222] border-[#E8C0B9]">
                            NO REQUEST
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-line">
            <Link href="/admin/returns" className="text-xs font-semibold text-wine-ink hover:underline">Open Returns →</Link>
          </div>
        </div>

        {/* 3. KTP pending */}
        <div className="bg-card border border-line rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h4 className="font-serif text-[16px] font-normal mb-3">KTP pending review</h4>
            <div className="space-y-3 text-xs">
              {metrics.triage.ktpPending.length === 0 ? (
                <p className="text-muted text-xs">All customer IDs verified.</p>
              ) : (
                metrics.triage.ktpPending.map((c) => (
                  <Link key={c.customerId} href={`/admin/customers/${c.customerId}`}
                    className="block group hover:bg-[#F6F4EF] p-1.5 -mx-1.5 rounded transition">
                    <div className="font-bold text-ink group-hover:text-wine-ink">{c.customerName}</div>
                    <div className="text-muted text-[11px]">{c.status}</div>
                  </Link>
                ))
              )}
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-line">
            <Link href="/admin/customers" className="text-xs font-semibold text-wine-ink hover:underline">Open Customers →</Link>
          </div>
        </div>

        {/* 4. Fittings today & tomorrow */}
        <div className="bg-card border border-line rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h4 className="font-serif text-[16px] font-normal mb-3">Fittings today & tomorrow</h4>
            <div className="space-y-3 text-xs">
              {metrics.triage.fittingsUpcoming.length === 0 ? (
                <p className="text-muted text-xs">No showroom fittings booked.</p>
              ) : (
                metrics.triage.fittingsUpcoming.map((fit) => (
                  <Link key={fit.id} href={`/admin/fittings/${fit.id}`}
                    className="block group hover:bg-[#F6F4EF] p-1.5 -mx-1.5 rounded transition">
                    <div className="font-bold text-ink group-hover:text-wine-ink">
                      {fit.timeLabel} · {fit.customerName}
                    </div>
                    <div className="text-muted text-[11px] truncate">{fit.dressesSummary}</div>
                  </Link>
                ))
              )}
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-line">
            <Link href="/admin/fittings" className="text-xs font-semibold text-wine-ink hover:underline">Open Fittings →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
