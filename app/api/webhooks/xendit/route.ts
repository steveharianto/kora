import { NextRequest, NextResponse } from "next/server";
import { markWebsiteOrderPaid } from "@/app/actions/checkout";
import { markFittingBookingPaid } from "@/app/actions/customerFittingBooking";

export async function POST(request: NextRequest) {
  const callbackToken = request.headers.get("x-callback-token");
  const expectedToken = process.env.XENDIT_WEBHOOK_TOKEN;

  if (!expectedToken) {
    return new NextResponse("Webhook token not configured", { status: 500 });
  }
  if (callbackToken !== expectedToken) {
    return new NextResponse("Invalid token", { status: 401 });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const {
    external_id,
    status,
    id,
    paid_amount,
    paid_at,
    payment_method,
    payment_channel,
  } = payload;

  if (!external_id) {
    return new NextResponse("Missing external_id", { status: 400 });
  }

  if (status === "PAID" || status === "SETTLED") {
    const meta = {
      invoice_id: id,
      status,
      paid_amount,
      paid_at,
      payment_method,
      payment_channel,
    };

    if (external_id.startsWith("FB-")) {
      // Fitting booking
      const res = await markFittingBookingPaid(external_id, meta);
      if (res.error) {
        console.error("Fitting webhook error:", res.error);
        return new NextResponse("Processing error", { status: 500 });
      }
    } else if (external_id.startsWith("S")) {
      // Website rental order
      const res = await markWebsiteOrderPaid(external_id, meta);
      if (res.error) {
        console.error("Order webhook error:", res.error);
        return new NextResponse("Processing error", { status: 500 });
      }
    } else {
      console.warn("Unknown external_id prefix:", external_id);
    }
  }

  return NextResponse.json({ received: true });
}
