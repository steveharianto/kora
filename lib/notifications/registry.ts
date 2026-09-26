// lib/notifications/registry.ts
//
// Single source of truth for every WhatsApp notification KORA can send.
// Each entry maps a `kind` (matching app_settings.notifications[kind]) to
// its entity, fallback template, and the variables it renders with.
//
// Both auto-fire call sites (checkout, customers, returns, etc.) and the
// admin-side NotificationPicker read from this registry.

import { formatRupiah } from '@/lib/utils';

export type Entity = 'order' | 'return' | 'fitting' | 'customer';

export interface NotificationVarDef {
  /** Placeholder key, e.g. "CUSTOMER_NAME" — matches [CUSTOMER_NAME] in the template. */
  key: string;
  /** Human label shown in the "missing fields" banner. */
  label: string;
  /** If true and the value resolves empty, the send is blocked. */
  required: boolean;
  /** Given the entity context (see fetchEntityContext), resolve this var. */
  compute: (ctx: any) => string | null;
}

export interface NotificationDef {
  kind: string;
  entity: Entity;
  label: string;
  description?: string;
  /** True when this notification is normally fired by an automatic action. */
  autoTriggered?: boolean;
  /** Fallback used if app_settings.notifications[kind].template is empty. */
  fallbackTemplate: string;
  vars: NotificationVarDef[];
  /** True when the UI should ask for a reason (e.g. ktp_rejected). */
  requiresReasonInput?: boolean;
}

const BASE_URL = () =>
  process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

function fullName(c: any): string | null {
  if (!c) return null;
  const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
  return name || null;
}

export const NOTIFICATION_REGISTRY: Record<string, NotificationDef> = {
  // ── Orders ────────────────────────────────────────────────────────────
  order_posted: {
    kind: 'order_posted',
    entity: 'order',
    label: 'Order Invoice',
    description: 'Order confirmation with invoice link and total.',
    autoTriggered: true,
    fallbackTemplate:
      'Hi [CUSTOMER_NAME], thank you for your order [ORDER_ID]! Here is your invoice link: [INVOICE_LINK]. Total: [TOTAL].',
    vars: [
      {
        key: 'CUSTOMER_NAME',
        label: 'Customer name',
        required: true,
        compute: (ctx) => fullName(ctx.order?.customers),
      },
      {
        key: 'ORDER_ID',
        label: 'Order ID',
        required: true,
        compute: (ctx) => ctx.order?.id ?? null,
      },
      {
        key: 'INVOICE_LINK',
        label: 'Invoice link',
        required: true,
        // Customer-facing order page (behind /account login).
        // The printable admin invoice view is NOT usable here — it's
        // behind the admin auth guard.
        compute: (ctx) =>
          ctx.order?.id ? `${BASE_URL()}/account/orders` : null,
      },
      {
        key: 'TOTAL',
        label: 'Total',
        required: true,
        compute: (ctx) => formatRupiah(Number(ctx.order?.total) || 0),
      },
    ],
  },

  package_shipped: {
    kind: 'package_shipped',
    entity: 'order',
    label: 'Package Shipped',
    description: 'Tracking link sent when the courier is booked.',
    autoTriggered: true,
    fallbackTemplate:
      'Hi [CUSTOMER_NAME], your order [ORDER_ID] is on its way! Track courier progress here: [TRACKING_LINK].',
    vars: [
      {
        key: 'CUSTOMER_NAME',
        label: 'Customer name',
        required: true,
        compute: (ctx) => fullName(ctx.order?.customers),
      },
      {
        key: 'ORDER_ID',
        label: 'Order ID',
        required: true,
        compute: (ctx) => ctx.order?.id ?? null,
      },
      {
        key: 'TRACKING_LINK',
        label: 'Tracking link',
        required: true,
        compute: (ctx) =>
          ctx.order?.return_label_url || ctx.order?.packing_slip_id || null,
      },
    ],
  },

  // ── Customers ─────────────────────────────────────────────────────────
  ktp_approved: {
    kind: 'ktp_approved',
    entity: 'customer',
    label: 'KTP Approved',
    description: 'ID verification approved.',
    autoTriggered: true,
    fallbackTemplate:
      'Hi [CUSTOMER_NAME], your ID verification has been approved! Your order is now confirmed for dispatch.',
    vars: [
      {
        key: 'CUSTOMER_NAME',
        label: 'Customer name',
        required: true,
        compute: (ctx) => fullName(ctx.customer),
      },
    ],
  },

  ktp_rejected: {
    kind: 'ktp_rejected',
    entity: 'customer',
    label: 'KTP Rejected',
    description: 'ID verification rejected — reason included.',
    autoTriggered: true,
    requiresReasonInput: true,
    fallbackTemplate:
      'Hi [CUSTOMER_NAME], we could not verify your ID: [REJECTION_REASON]. Please upload a clearer photo on your KORA account.',
    vars: [
      {
        key: 'CUSTOMER_NAME',
        label: 'Customer name',
        required: true,
        compute: (ctx) => fullName(ctx.customer),
      },
      {
        key: 'REJECTION_REASON',
        label: 'Rejection reason',
        required: true,
        compute: (ctx) => {
          const r = ctx.overrides?.REJECTION_REASON;
          return typeof r === 'string' && r.trim() ? r.trim() : null;
        },
      },
    ],
  },

  // ── Returns ───────────────────────────────────────────────────────────
  return_reminder: {
    kind: 'return_reminder',
    entity: 'return',
    label: 'Return Reminder',
    description: 'Nudge the customer about their return deadline.',
    fallbackTemplate:
      'Hi [CUSTOMER_NAME], friendly reminder that your rental return deadline is [RETURN_DEADLINE]. Please ensure the original garment bag is packed.',
    vars: [
      {
        key: 'CUSTOMER_NAME',
        label: 'Customer name',
        required: true,
        compute: (ctx) => fullName(ctx.return?.customers),
      },
      {
        key: 'RETURN_DEADLINE',
        label: 'Return deadline',
        required: true,
        compute: (ctx) => ctx.return?.orders?.return_date ?? null,
      },
    ],
  },

  deposit_refunded: {
    kind: 'deposit_refunded',
    entity: 'return',
    label: 'Deposit Refunded',
    description: 'Deposit release confirmation with QC summary.',
    autoTriggered: true,
    fallbackTemplate:
      'Hi [CUSTOMER_NAME], your deposit refund of [REFUND_AMOUNT] has been transferred. [QC_SUMMARY] Thank you for choosing KORA!',
    vars: [
      {
        key: 'CUSTOMER_NAME',
        label: 'Customer name',
        required: true,
        compute: (ctx) => fullName(ctx.return?.customers),
      },
      {
        key: 'REFUND_AMOUNT',
        label: 'Refund amount',
        required: true,
        compute: (ctx) =>
          formatRupiah(Number(ctx.return?.refund_amount) || 0),
      },
      {
        key: 'QC_SUMMARY',
        label: 'QC summary',
        required: false,
        compute: (ctx) => {
          const r = ctx.return;
          if (!r) return '';
          const parts: string[] = [];
          if (r.has_stains) parts.push('stains');
          if (r.has_damage) parts.push('damage');
          if (r.is_incomplete) parts.push('missing items');
          if (r.has_odor) parts.push('odor');
          return parts.length > 0
            ? `QC notes: ${parts.join(', ')}.`
            : 'All items passed QC — no deductions.';
        },
      },
    ],
  },

  // ── Fittings ──────────────────────────────────────────────────────────
  fitting_reminder: {
    kind: 'fitting_reminder',
    entity: 'fitting',
    label: 'Fitting Reminder',
    description: 'Reminder for an upcoming showroom appointment.',
    fallbackTemplate:
      'Hi [CUSTOMER_NAME], reminder for your fitting appointment tomorrow at [FITTING_TIME]. See you at our showroom!',
    vars: [
      {
        key: 'CUSTOMER_NAME',
        label: 'Customer name',
        required: true,
        compute: (ctx) => fullName(ctx.fitting?.customers),
      },
      {
        key: 'FITTING_TIME',
        label: 'Fitting time',
        required: true,
        compute: (ctx) => {
          const f = ctx.fitting;
          if (!f) return null;
          const slot = f.slot ? String(f.slot).slice(0, 5) : '10:00';
          return `${f.date} · ${slot}`;
        },
      },
      {
        key: 'FITTING_DATE',
        label: 'Fitting date',
        required: false,
        compute: (ctx) => (ctx.fitting?.date ? String(ctx.fitting.date) : ''),
      },
    ],
  },
};

export function getDef(kind: string): NotificationDef | null {
  return NOTIFICATION_REGISTRY[kind] ?? null;
}

export function defsForEntity(entity: Entity): NotificationDef[] {
  return Object.values(NOTIFICATION_REGISTRY).filter((d) => d.entity === entity);
}
