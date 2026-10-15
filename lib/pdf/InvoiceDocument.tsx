// lib/pdf/InvoiceDocument.tsx
//
// Server-side invoice PDF. Mirrors the layout of
// /admin/orders/[id]/invoice — kept intentionally in sync so the printed
// admin view and the customer-facing PDF look identical.
//
// Only built-in PDF fonts are used (Helvetica / Times / Courier) so we
// don't ship font binaries.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { formatRupiah } from "@/lib/utils";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },

  /* ── Header ───────────────────────────────────────────── */
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    paddingBottom: 12,
    marginBottom: 20,
  },
  brand: {
    fontFamily: "Times-Roman",
    fontSize: 22,
    letterSpacing: 6,
    marginBottom: 4,
  },
  brandSub: { fontSize: 9, color: "#666", marginBottom: 2 },
  orderId: {
    fontFamily: "Courier-Bold",
    fontSize: 16,
    textAlign: "right",
    marginBottom: 4,
  },
  metaLine: { fontSize: 9, color: "#666", textAlign: "right" },

  /* ── Two column block ─────────────────────────────────── */
  twoCol: { flexDirection: "row", gap: 24, marginBottom: 22 },
  col: { flex: 1 },
  sectionLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#666",
    letterSpacing: 1,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  strong: { fontFamily: "Helvetica-Bold", fontSize: 12, marginBottom: 2 },
  muted: { color: "#555", fontSize: 10, lineHeight: 1.4 },

  /* ── Items table ──────────────────────────────────────── */
  table: { marginBottom: 22 },
  tHead: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#000",
    paddingBottom: 4,
    marginBottom: 2,
  },
  tRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e5e5",
    paddingVertical: 5,
  },
  th: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  td: { fontSize: 9.5 },
  cSku: { width: "17%" },
  cDesc: { flex: 1 },
  cQty: { width: "8%", textAlign: "center" },
  cRight: { width: "14%", textAlign: "right" },
  /*
   * Wider column, used ONLY when the per-line day breakdown is rendered.
   * The longest stacked line is "+ Rp 400.000 × N extra days" — 14% (the
   * legacy cRight width) would clip it; 22% fits it cleanly at font 8.5.
   *
   * Legacy orders continue to use `cRight` at 14%, so their rendered PDF
   * is byte-identical to the pre-feature baseline (Q5).
   */
  cBreakdown: { width: "22%", textAlign: "right" },

  /* ── Totals ───────────────────────────────────────────── */
  totalsBlock: { alignItems: "flex-end", marginBottom: 26 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 3,
  },
  totalsLabel: {
    width: 150,
    textAlign: "right",
    fontSize: 10,
    color: "#555",
    paddingRight: 12,
  },
  totalsValue: { width: 100, textAlign: "right", fontSize: 10 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#000",
    paddingTop: 6,
    marginTop: 4,
  },
  grandLabel: {
    width: 150,
    textAlign: "right",
    fontSize: 12,
    fontFamily: "Times-Bold",
    paddingRight: 12,
  },
  grandValue: {
    width: 100,
    textAlign: "right",
    fontSize: 12,
    fontFamily: "Times-Bold",
  },

  /* ── Terms ────────────────────────────────────────────── */
  terms: {
    borderTopWidth: 0.5,
    borderTopColor: "#ccc",
    paddingTop: 10,
    fontSize: 9,
    color: "#666",
    lineHeight: 1.45,
  },
});

interface Props {
  order: any;
}

export function InvoiceDocument({ order }: Props) {
  const customerName =
    `${order.customers?.first_name || ""} ${order.customers?.last_name || ""}`.trim() ||
    "Customer";
  const items: any[] = order.order_products || [];
  const totalPaid = Number(order.total) || 0;
  const hasCredit = Number(order.store_credit_applied) > 0;

  /*
   * Legacy-vs-modern discriminator (Q5), mirroring the HTML invoice.
   *
   * The multi-day pricing feature writes a permanent per-line breakdown
   * (`base_price` / `add_on_price` / `days`) on every order created after
   * Steps 9 and 11 shipped. Orders created before that have NULL on all
   * three columns.
   *
   * Render the stacked breakdown ONLY when every line carries a non-null
   * `base_price`. Historical PDFs stay exactly as they were — same
   * layout, same column widths (cRight at 14%, not cBreakdown), same
   * totals block.
   *
   * `.every()` means a mixed order (unreachable in practice) falls back
   * to legacy rendering rather than producing a half-broken table.
   */
  const showBreakdown =
    items.length > 0 && items.every((l) => l.base_price != null);

  return (
    <Document
      title={`KORA Invoice ${order.id}`}
      author="KORA"
      subject={`Rental invoice for order ${order.id}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>K O R A</Text>
            <Text style={styles.brandSub}>
              Designer Apparel Rental &amp; Curated Archive
            </Text>
            <Text style={styles.brandSub}>
              Jakarta Selatan — biteship pickup hub
            </Text>
          </View>
          <View>
            <Text style={styles.orderId}>{order.id}</Text>
            <Text style={styles.metaLine}>
              Date: {new Date(order.order_date).toLocaleDateString("en-GB")}
            </Text>
            <Text style={styles.metaLine}>
              Waybill: {order.packing_slip_id || "Manual Courier"}
            </Text>
          </View>
        </View>

        {/* Customer + Schedule */}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Billed &amp; Shipped To</Text>
            <Text style={styles.strong}>{customerName}</Text>
            <Text style={styles.muted}>{order.customers?.phone || ""}</Text>
            <Text style={[styles.muted, { marginTop: 4 }]}>
              {order.street_address}, {order.city} {order.postal_code || ""}
            </Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Rental Schedule</Text>
            <Text style={styles.td}>
              Event Date: {order.event_start_date || "—"} ({order.event_days}{" "}
              day)
            </Text>
            <Text style={styles.td}>
              Dispatched: {order.pickup_date || "—"}
            </Text>
            <Text style={styles.td}>
              Return Deadline: {order.return_date || "—"}
            </Text>
            <Text style={[styles.td, { marginTop: 3 }]}>
              Method: {order.pick_up_method || "Standard Courier"}
            </Text>
          </View>
        </View>

        {/* Items */}
        <View style={styles.table}>
          <View style={styles.tHead}>
            <Text style={[styles.th, styles.cSku]}>Item SKU</Text>
            <Text style={[styles.th, styles.cDesc]}>Description</Text>
            <Text style={[styles.th, styles.cQty]}>Qty</Text>
            {/*
             * Header column swaps label AND width together with the row
             * content below. Using `cBreakdown` (22%) instead of `cRight`
             * (14%) here keeps the header text aligned with its column.
             */}
            <Text
              style={[
                styles.th,
                showBreakdown ? styles.cBreakdown : styles.cRight,
              ]}
            >
              {showBreakdown ? "Breakdown" : "Rental Fee"}
            </Text>
            <Text style={[styles.th, styles.cRight]}>Deposit</Text>
            <Text style={[styles.th, styles.cRight]}>Subtotal</Text>
          </View>
          {items.map((op: any, i: number) => (
            <View key={i} style={styles.tRow}>
              <Text
                style={[styles.td, styles.cSku, { fontFamily: "Courier-Bold" }]}
              >
                {op.item_sku}
              </Text>
              <Text style={[styles.td, styles.cDesc]}>
                {op.items?.name || "Designer Garment"}
              </Text>
              <Text style={[styles.td, styles.cQty]}>{op.quantity}</Text>
              {/*
               * Per-line pricing cell.
               *
               *   showBreakdown === true
               *     → stacked breakdown written by the server at save time.
               *       Values come from the order line's permanent snapshot,
               *       so editing the dress's rate later cannot rewrite
               *       history. `op.price` is per-unit, so
               *       `op.price × op.quantity` is the line total.
               *
               *   showBreakdown === false
               *     → the original single-line flat rental fee, identical
               *       to the pre-feature rendering.
               *
               * Uses `<View>` with nested `<Text>` children because
               * @react-pdf/renderer requires a flex container to stack
               * multiple lines in a single cell. The parent row is
               * `flexDirection: "row"`; this View is treated as one of
               * the row's children and picks up its column width from
               * `styles.cBreakdown` (or `styles.cRight` for legacy).
               */}
              {showBreakdown ? (
                <View style={styles.cBreakdown}>
                  <Text style={[styles.td, { textAlign: "right" }]}>
                    Day 1: {formatRupiah(Number(op.base_price))}
                  </Text>
                  {Number(op.days) > 1 && (
                    <Text
                      style={[
                        styles.td,
                        {
                          textAlign: "right",
                          color: "#666",
                          fontSize: 8.5,
                        },
                      ]}
                    >
                      + {formatRupiah(Number(op.add_on_price))} ×{" "}
                      {Number(op.days) - 1} extra day
                      {Number(op.days) - 1 === 1 ? "" : "s"}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.td,
                      {
                        textAlign: "right",
                        fontFamily: "Helvetica-Bold",
                        fontSize: 9,
                        marginTop: 2,
                        borderTopWidth: 0.5,
                        borderTopColor: "#d0d0d0",
                        paddingTop: 2,
                      },
                    ]}
                  >
                    {formatRupiah(Number(op.price) * Number(op.quantity))}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.td, styles.cRight]}>
                  {formatRupiah(Number(op.price))}
                </Text>
              )}
              <Text style={[styles.td, styles.cRight]}>
                {formatRupiah(Number(op.deposit))}
              </Text>
              <Text
                style={[
                  styles.td,
                  styles.cRight,
                  { fontFamily: "Helvetica-Bold" },
                ]}
              >
                {formatRupiah(Number(op.price) * Number(op.quantity))}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Rental Subtotal:</Text>
            <Text style={styles.totalsValue}>
              {formatRupiah(Number(order.total_price))}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Refundable Deposit:</Text>
            <Text style={styles.totalsValue}>
              {formatRupiah(Number(order.total_deposit))}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Shipping:</Text>
            <Text style={styles.totalsValue}>
              {formatRupiah(Number(order.shipping_fee))}
            </Text>
          </View>
          {hasCredit && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Store Credit:</Text>
              <Text style={styles.totalsValue}>
                - {formatRupiah(Number(order.store_credit_applied))}
              </Text>
            </View>
          )}
          {/*
           * Informational breakdown row, new orders only. Shows the
           * portion of the rental subtotal that came from extra days
           * rather than Day 1 base charges. Historical PDFs skip this
           * row entirely — their totals block is unchanged.
           */}
          {showBreakdown && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Additional-day charges:</Text>
              <Text style={styles.totalsValue}>
                {formatRupiah(
                  items.reduce(
                    (s, l) =>
                      s +
                      Number(l.add_on_price || 0) *
                        Math.max(0, (Number(l.days) || 1) - 1) *
                        Number(l.quantity || 1),
                    0,
                  ),
                )}
              </Text>
            </View>
          )}
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Total Paid:</Text>
            <Text style={styles.grandValue}>{formatRupiah(totalPaid)}</Text>
          </View>
        </View>

        {/* Terms */}
        <View style={styles.terms}>
          <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>
            Return &amp; Deposit Terms:
          </Text>
          <Text>
            Garments must be returned by the return deadline indicated above.
            Security deposit will be refunded via original payment method within
            2 × 24 hours after passing quality control inspection.
          </Text>
          <Text style={{ marginTop: 8, fontSize: 8, color: "#999" }}>
            KORA · Designer Apparel Rental · daysinkora@gmail.com · @daysinkora
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/** Renders the invoice to a Node Buffer — the shape Supabase Storage expects. */
export async function renderInvoicePdf(order: any): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument order={order} />);
}
