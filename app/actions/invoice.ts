// app/actions/invoice.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "./auth";
import { renderInvoicePdf } from "@/lib/pdf/InvoiceDocument";

const BUCKET = "order-invoices";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 6;

export interface InvoiceAttachment {
  /** Signed URL — kept for archival / manual download by the admin. */
  url: string;
  /** Raw base64 bytes — handed to Fonnte so it doesn't need to fetch. */
  base64: string;
  /** Display name on the WhatsApp document bubble. */
  filename: string;
  /** Storage path — for debugging / cleanup. */
  path: string;
  /** Size in bytes — surfaced in dev logs to catch empty renders. */
  size: number;
}

export async function generateInvoiceAttachment(
  orderId: string,
): Promise<InvoiceAttachment> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Unauthorized");

  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      customers ( first_name, last_name, phone ),
      order_products (
        item_sku,
        quantity,
        price,
        deposit,
        subtotal,
        items ( name )
      )
    `,
    )
    .eq("id", orderId)
    .single();

  if (error || !order) {
    throw new Error(`Order ${orderId} not found for invoice generation.`);
  }

  const pdfBuffer = await renderInvoicePdf(order);

  // Sanity check — @react-pdf/renderer can silently produce an empty buffer
  // if a font fails to load. A real A4 invoice is never this small.
  if (!pdfBuffer || pdfBuffer.length < 800) {
    throw new Error(
      `Rendered invoice PDF is suspiciously small (${pdfBuffer?.length ?? 0} bytes). Check @react-pdf/renderer output.`,
    );
  }

  const filename = `KORA-Invoice-${orderId}.pdf`;
  const path = `${orderId}/${Date.now()}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Invoice upload failed: ${uploadError.message}`);
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    throw new Error(
      `Could not sign invoice URL: ${signError?.message ?? "unknown"}`,
    );
  }

  return {
    url: signed.signedUrl,
    base64: pdfBuffer.toString("base64"),
    filename,
    path,
    size: pdfBuffer.length,
  };
}
