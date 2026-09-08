import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { formatRupiah } from '@/lib/utils';
import PrintButton from '../PrintButton';

export default async function OrderInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select(`
      *,
      customers (
        first_name,
        last_name,
        phone
      ),
      order_products (
        item_sku,
        quantity,
        price,
        deposit,
        subtotal,
        items (
          name
        )
      )
    `)
    .eq('id', id)
    .single();

  if (!order) notFound();

  const customerName = `${order.customers?.first_name || ''} ${order.customers?.last_name || ''}`.trim();

  return (
    <>
      <div
        id="invoice-document"
        className="bg-white min-h-screen p-8 text-black font-sans max-w-3xl mx-auto"
      >
        {/* Invoice Header */}
        <div className="flex justify-between items-start border-b pb-6 mb-6">
          <div>
            <h1 className="text-3xl font-serif tracking-wide font-bold">K O R A</h1>
            <p className="text-xs text-gray-500 mt-1">Designer Apparel Rental & Curated Archive</p>
            <p className="text-xs text-gray-500">Jakarta Selatan — biteship pickup hub</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold font-mono">{order.id}</div>
            <div className="text-xs text-gray-500 mt-1">
              Date: {new Date(order.order_date).toLocaleDateString()}
            </div>
            <div className="text-xs text-gray-500">
              Waybill: {order.packing_slip_id || 'Manual Courier'}
            </div>
          </div>
        </div>

        {/* Customer & Shipping Details */}
        <div className="grid grid-cols-2 gap-6 text-sm mb-6">
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-1">Billed & Shipped To</h3>
            <p className="font-semibold text-base">{customerName}</p>
            <p className="text-gray-700">{order.customers?.phone}</p>
            <p className="text-gray-600 mt-1 leading-relaxed">
              {order.street_address}, {order.city} {order.postal_code}
            </p>
          </div>
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-1">Rental Schedule</h3>
            <p>
              <span className="text-gray-500">Event Date:</span> {order.event_start_date || '—'} ({order.event_days} day)
            </p>
            <p>
              <span className="text-gray-500">Dispatched:</span> {order.pickup_date || '—'}
            </p>
            <p>
              <span className="text-gray-500">Return Deadline:</span> {order.return_date || '—'}
            </p>
            <p className="mt-1">
              <span className="text-gray-500">Method:</span> {order.pick_up_method || 'Standard Courier'}
            </p>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full text-left text-sm border-collapse mb-6">
          <thead>
            <tr className="border-b-2 border-black text-xs uppercase tracking-wider">
              <th className="py-2">Item SKU</th>
              <th className="py-2">Description</th>
              <th className="py-2 text-center">Qty</th>
              <th className="py-2 text-right">Rental Fee</th>
              <th className="py-2 text-right">Deposit</th>
              <th className="py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {(order.order_products || []).map((op: any, i: number) => (
              <tr key={i}>
                <td className="py-3 font-mono font-medium">{op.item_sku}</td>
                <td className="py-3">{op.items?.name || 'Designer Garment'}</td>
                <td className="py-3 text-center">{op.quantity}</td>
                <td className="py-3 text-right">{formatRupiah(Number(op.price))}</td>
                <td className="py-3 text-right">{formatRupiah(Number(op.deposit))}</td>
                <td className="py-3 text-right font-medium">
                  {formatRupiah(Number(op.price) * Number(op.quantity))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals Breakdown */}
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Rental Subtotal:</span>
              <span>{formatRupiah(Number(order.total_price))}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Refundable Deposit:</span>
              <span>{formatRupiah(Number(order.total_deposit))}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Shipping:</span>
              <span>{formatRupiah(Number(order.shipping_fee))}</span>
            </div>
            {Number(order.store_credit_applied) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Store Credit:</span>
                <span>- {formatRupiah(Number(order.store_credit_applied))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
              <span>Total Paid:</span>
              <span>{formatRupiah(Number(order.total))}</span>
            </div>
          </div>
        </div>

        {/* Terms & Return instructions */}
        <div className="border-t pt-4 text-xs text-gray-500 leading-relaxed">
          <p className="font-semibold text-gray-700 mb-1">Return & Deposit Terms:</p>
          <p>
            Garments must be returned by the return deadline indicated above. Security deposit will be refunded
            via original payment method within 2 × 24 hours after passing quality control inspection.
          </p>
        </div>

        {/* Action Controls */}
        <div className="mt-8 text-center print:hidden">
          <PrintButton
            label="Print / Save as PDF"
            className="px-5 py-2 bg-black text-white text-xs font-semibold rounded cursor-pointer hover:bg-neutral-800"
          />
        </div>
      </div>

      {/* Strict A4 Print Stylesheet */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 15mm;
              }
              html, body {
                background: #ffffff !important;
                color: #000000 !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              /* Hide layout shell and controls */
              aside, nav, header, footer, button, a, .print\\:hidden {
                display: none !important;
              }
              /* Neutralize AdminLayout sidebar margin offset */
              main {
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                min-width: 100% !important;
              }
              #invoice-document {
                padding: 0 !important;
                margin: 0 auto !important;
                max-width: 100% !important;
                width: 100% !important;
                box-shadow: none !important;
                border: none !important;
              }
            }
          `,
        }}
      />
    </>
  );
}
