const XENDIT_API = "https://api.xendit.co";

function getAuthHeader(): string {
  const key = process.env.XENDIT_SECRET_KEY;
  if (!key) throw new Error("XENDIT_SECRET_KEY is not configured.");
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

export interface XenditInvoiceItem {
  name: string;
  quantity: number;
  price: number;
}

export interface CreateXenditInvoicePayload {
  external_id: string;
  amount: number;
  description: string;
  customer: {
    given_names: string;
    surname?: string;
    email?: string;
    mobile_number?: string;
  };
  items: XenditInvoiceItem[];
  success_redirect_url: string;
  failure_redirect_url: string;
  currency?: string;
}

export interface XenditInvoiceResponse {
  success: boolean;
  id?: string;
  invoice_url?: string;
  status?: string;
  error?: string;
}

export async function createXenditInvoice(
  payload: CreateXenditInvoicePayload,
): Promise<XenditInvoiceResponse> {
  try {
    const res = await fetch(`${XENDIT_API}/v2/invoices`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_id: payload.external_id,
        amount: payload.amount,
        description: payload.description,
        customer: payload.customer,
        items: payload.items,
        currency: payload.currency || "IDR",
        success_redirect_url: payload.success_redirect_url,
        failure_redirect_url: payload.failure_redirect_url,
        // Reasonable defaults for a retail session
        invoice_duration: 60 * 60 * 24, // 24h
        payment_methods: [
          "BCA",
          "BNI",
          "BRI",
          "MANDIRI",
          "PERMATA",
          "BSI",
          "BJB",
          "QRIS",
          "OVO",
          "DANA",
          "LINKAJA",
          "SHOPEEPAY",
          "CREDIT_CARD",
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error:
          data?.error_code
            ? `${data.error_code}: ${data.message || ""}`
            : data?.message || "Xendit invoice creation failed.",
      };
    }

    return {
      success: true,
      id: data.id,
      invoice_url: data.invoice_url,
      status: data.status,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Network error contacting Xendit.",
    };
  }
}
