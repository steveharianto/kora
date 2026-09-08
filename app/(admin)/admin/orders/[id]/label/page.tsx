import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import PrintButton from '../PrintButton';

function Code128Barcode({ text }: { text: string }) {
  const PATTERNS: number[] = [
    212222, 222122, 222221, 121223, 121322, 131222, 122213, 122312, 132212, 221213,
    221312, 231212, 112232, 122132, 122231, 113222, 123122, 123221, 223211, 221132,
    221231, 213212, 223112, 312131, 311222, 321122, 321221, 312212, 322112, 322211,
    212123, 212321, 232121, 111323, 131123, 131321, 112313, 132113, 132311, 211313,
    231113, 231311, 112133, 112331, 132131, 113123, 113321, 133121, 313121, 211331,
    231131, 213113, 213311, 213131, 311123, 311321, 331121, 312113, 312311, 332111,
    314111, 221411, 431111, 111224, 111422, 121124, 121421, 141122, 141221, 112214,
    112412, 122114, 122411, 142112, 142211, 241211, 221114, 413111, 241112, 134111,
    111242, 121142, 121241, 114212, 124112, 124211, 411212, 421112, 421211, 212141,
    214121, 412121, 111143, 111341, 131141, 114113, 114311, 411113, 411311, 113141,
    114131, 311141, 411131, 211412, 211214, 211232, 2331112
  ];

  const START_B = 104;
  const STOP = 106;

  const codes: number[] = [START_B];
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    codes.push(charCode - 32);
  }

  let checksum = START_B;
  for (let i = 1; i < codes.length; i++) {
    checksum += codes[i] * i;
  }
  codes.push(checksum % 103);
  codes.push(STOP);

  let barString = '';
  for (const c of codes) {
    const pattern = PATTERNS[c].toString();
    for (let i = 0; i < pattern.length; i++) {
      const width = parseInt(pattern[i], 10);
      const isBar = i % 2 === 0;
      barString += (isBar ? '1' : '0').repeat(width);
    }
  }

  const barWidth = 2;
  const totalWidth = barString.length * barWidth;

  return (
    <div className="flex flex-col items-center">
      <svg
        width="100%"
        height="50"
        viewBox={`0 0 ${totalWidth} 50`}
        preserveAspectRatio="none"
        className="w-full"
      >
        {Array.from(barString).map((bit, idx) =>
          bit === '1' ? (
            <rect
              key={idx}
              x={idx * barWidth}
              y="0"
              width={barWidth}
              height="50"
              fill="black"
            />
          ) : null
        )}
      </svg>
      <div className="font-mono text-[11px] font-bold tracking-[0.22em] mt-1 text-black">
        {text}
      </div>
    </div>
  );
}

export default async function OrderShippingLabelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [orderRes, settingsRes] = await Promise.all([
    supabase
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
          items (
            name,
            size,
            color
          )
        )
      `)
      .eq('id', id)
      .single(),

    supabase.from('app_settings').select('value').eq('key', 'shipping').single(),
  ]);

  if (!orderRes.data) notFound();

  const order = orderRes.data;
  const rawOrigin = settingsRes.data?.value?.dispatch_addresses?.primary;
  const origin = typeof rawOrigin === 'object' && rawOrigin !== null ? rawOrigin : {
    name: 'KORA Showroom Jakarta',
    phone: '081234567890',
    street_address: 'Jl. Gunawarman No. 30, Kebayoran Baru',
    city: 'Jakarta Selatan',
    postal_code: '12180',
  };

  const recipientName = `${order.customers?.first_name || ''} ${order.customers?.last_name || ''}`.trim();
  const courierTag = (order.pick_up_method || 'JNE - REG').toUpperCase();
  const waybill = order.packing_slip_id || order.id;

  return (
    <div className="min-h-screen py-6 print:p-0 flex flex-col items-center">
      {/* Non-printed Controls */}
      <div className="w-[100mm] mb-3 flex justify-between items-center print:hidden">
        <a
          href={`/admin/orders/${order.id}`}
          className="text-xs text-neutral-600 hover:text-black font-medium"
        >
          ← Back to Order
        </a>
        <PrintButton
          label="Print Thermal Label (A6)"
          className="bg-black text-white text-xs font-semibold px-3.5 py-1.5 rounded shadow hover:bg-neutral-800 cursor-pointer"
        />
      </div>

      {/* Printable Thermal Label Canvas */}
      <div
        id="thermal-label"
        className="w-[100mm] h-[150mm] max-w-[100mm] max-h-[150mm] bg-white border-2 border-black p-3.5 text-black font-sans box-border shadow-md print:shadow-none flex flex-col justify-between overflow-hidden"
      >
        {/* Top Header */}
        <div className="border-b-2 border-black pb-1.5 flex justify-between items-end">
          <div>
            <div className="font-serif font-bold text-xl tracking-wider leading-none">
              K O R A
            </div>
            <div className="text-[8.5px] uppercase font-mono tracking-widest text-neutral-600 mt-0.5">
              ORDER: {order.id}
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block border-2 border-black px-2 py-0.5 text-xs font-bold tracking-wider font-mono">
              {courierTag}
            </span>
          </div>
        </div>

        {/* Barcode */}
        <div className="py-2 border-b-2 border-black">
          <Code128Barcode text={waybill} />
        </div>

        {/* Recipient */}
        <div className="py-2 border-b-2 border-black leading-tight">
          <div className="text-[8.5px] font-mono tracking-widest uppercase font-bold text-neutral-500 mb-0.5">
            SHIP TO (RECIPIENT)
          </div>
          <div className="text-sm font-bold truncate">{recipientName}</div>
          <div className="text-[11px] font-mono font-bold mt-0.5">{order.customers?.phone}</div>
          <div className="text-[11px] leading-snug mt-1 font-medium line-clamp-2">
            {order.street_address}
          </div>
          <div className="text-[11px] font-bold uppercase mt-0.5">
            {order.city} {order.postal_code ? `, ${order.postal_code}` : ''}
          </div>
        </div>

        {/* Sender */}
        <div className="py-1.5 border-b-2 border-black text-[10.5px] leading-tight">
          <div className="text-[8.5px] font-mono tracking-widest uppercase font-bold text-neutral-500 mb-0.5">
            FROM (SENDER)
          </div>
          <div className="font-bold">{origin.name || 'KORA Showroom'}</div>
          <div className="font-mono text-[10px]">{origin.phone || '081234567890'}</div>
          <div className="text-[10px] text-neutral-700 truncate mt-0.5">
            {origin.street_address}, {origin.city} {origin.postal_code}
          </div>
        </div>

        {/* Rental Item Manifest */}
        <div className="py-1.5 border-b-2 border-black">
          <div className="text-[8.5px] font-mono tracking-widest uppercase font-bold text-neutral-500 mb-0.5">
            RENTAL CONTENTS ({order.order_products?.length || 0} ITEM)
          </div>
          <div className="space-y-0.5 text-[9.5px]">
            {(order.order_products || []).slice(0, 2).map((p: any, i: number) => (
              <div key={i} className="flex justify-between items-center">
                <span className="font-mono font-bold w-12 truncate">{p.item_sku}</span>
                <span className="truncate flex-1 px-1">{p.items?.name || 'Garment'}</span>
                <span className="font-mono">Qty: {p.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Return Notice */}
        <div className="pt-1 text-[8.5px] text-neutral-700 leading-tight">
          <div className="font-bold uppercase tracking-wider text-black">
            RETURN DEADLINE: {order.return_date || 'Day 4'}
          </div>
          <div>Please keep original hanger, garment bag, and return package securely.</div>
        </div>
      </div>

      {/* Strict Print Layout Rules */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: 100mm 150mm;
            margin: 0 !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100mm !important;
            height: 150mm !important;
            background: white !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* Hide sidebar, navigation, buttons, and all parent wrapper elements */
          aside, nav, header, footer, button, a {
            display: none !important;
          }
          body * {
            visibility: hidden;
          }
          #thermal-label, #thermal-label * {
            visibility: visible;
          }
          #thermal-label {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100mm !important;
            height: 150mm !important;
            max-width: 100mm !important;
            max-height: 150mm !important;
            margin: 0 !important;
            padding: 3.5mm !important;
            box-sizing: border-box !important;
            border: 2px solid black !important;
            background: white !important;
            z-index: 999999 !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            overflow: hidden !important;
          }
        }
      `}} />
    </div>
  );
}
