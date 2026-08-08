import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatTime24to12, normalizePhone } from "@/lib/format";
import { getMailSender, type MailMessage } from "@/server/messaging/mail";
import { getSmsSender } from "@/server/messaging/sms";
import { getSettings, settingText } from "./settings.service";

/**
 * Telling the customer their order went through.
 *
 * Two rules govern everything in this file.
 *
 * First, **nothing here may throw into the caller**. The order is already
 * committed by the time these run; a mail provider having a bad afternoon must
 * not turn a successful order into an error on the customer's screen, or worse,
 * into a retry that places it twice. Every send is wrapped and failures are
 * logged, not raised.
 *
 * Second, sends happen *after* the transaction commits, never inside it. An
 * outbound HTTP call inside `prisma.$transaction` holds a database connection
 * open for the length of someone else's API call, and would still deliver a
 * receipt for an order that later rolled back.
 *
 * There is no queue or worker in this app, so delivery is best-effort and
 * one-shot. If a message is lost the order is still in `/admin/orders` and on
 * the customer's `/track` page — the notification is a convenience, not the
 * system of record.
 */

/** What the templates need. Fetched once, shared by both channels. */
type ReceiptOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

async function loadOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, pickupSlot: true },
  });
}

/**
 * Fire the customer's confirmations for a freshly placed order.
 *
 * Call it without `await` from the route handler, or await it and ignore the
 * result — either way it resolves, never rejects.
 */
export async function sendOrderPlacedNotifications(orderId: string): Promise<void> {
  try {
    const [order, settings] = await Promise.all([loadOrder(orderId), getSettings()]);
    if (!order) return;

    const brand = {
      siteName: settingText(settings, "site.name", "V-Kitchen"),
      currency: settingText(settings, "site.currency", "INR"),
      phone: settingText(settings, "contact.phone"),
      address: settingText(settings, "contact.address"),
      pickupNote: settingText(settings, "contact.pickupNote"),
      siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, ""),
    };

    // Both channels are independent: no email on file must not stop the SMS,
    // and a failed SMS must not stop the receipt.
    await Promise.allSettled([
      order.contactEmail
        ? deliver("email", () => getMailSender().send(renderOrderReceipt(order, brand)))
        : Promise.resolve(),
      deliver("sms", () =>
        getSmsSender().send({
          to: normalizePhone(order.contactPhone),
          body: renderOrderSms(order, brand),
        }),
      ),
    ]);
  } catch (error) {
    console.error("[notify] order-placed notifications failed:", error);
  }
}

/** Swallow and log. The channel name makes the log line greppable. */
async function deliver(channel: string, send: () => Promise<void>): Promise<void> {
  try {
    await send();
  } catch (error) {
    console.error(`[notify] ${channel} delivery failed:`, error);
  }
}

interface Brand {
  siteName: string;
  currency: string;
  phone: string;
  address: string;
  pickupNote: string;
  siteUrl: string;
}

/** When to collect, in the words the customer chose at checkout. */
function pickupWindow(order: ReceiptOrder): string {
  const day = formatDate(order.pickupDate);
  if (order.pickupSlot) {
    return `${day}, ${formatTime24to12(order.pickupSlot.startTime)} – ${formatTime24to12(order.pickupSlot.endTime)}`;
  }
  if (order.pickupTime) return `${day}, around ${formatTime24to12(order.pickupTime)}`;
  return day;
}

/**
 * One SMS, kept under a single 160-character segment where possible — each
 * extra segment is billed separately, and an order number plus a pickup time is
 * all anyone actually needs from a text.
 */
function renderOrderSms(order: ReceiptOrder, brand: Brand): string {
  const total = formatCurrency(order.total, { currency: brand.currency });
  return `${brand.siteName}: order ${order.orderNo} received. ${total}, collect ${pickupWindow(order)}. We'll message you when it's ready.`;
}

/**
 * The receipt.
 *
 * Amounts come from the order's own stored figures and item names from the
 * line snapshots — not from the live menu — so a receipt re-rendered next month
 * still shows what was actually charged.
 *
 * Written as inline-styled tables because that is what mail clients render:
 * Gmail strips `<style>` blocks and Outlook's engine has no flexbox or grid. The
 * plain-text part is not a fallback nobody sees — it is what SMS-to-email
 * gateways, screen readers and spam scoring all read.
 */
export function renderOrderReceipt(order: ReceiptOrder, brand: Brand): MailMessage {
  const money = (value: Parameters<typeof formatCurrency>[0]) =>
    formatCurrency(value, { currency: brand.currency, showDecimals: true });

  const when = pickupWindow(order);
  const trackUrl = brand.siteUrl ? `${brand.siteUrl}/track` : "";
  const discount = Number(order.discount);

  const rows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #ececec;color:#1f2320;font-size:14px;">
            ${escapeHtml(item.nameSnapshot)}${item.variantSnapshot ? ` <span style="color:#6b7280;">· ${escapeHtml(item.variantSnapshot)}</span>` : ""}
            <br /><span style="color:#6b7280;font-size:12px;">${item.quantity} × ${money(item.unitPrice)}</span>
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid #ececec;color:#1f2320;font-size:14px;white-space:nowrap;">
            ${money(item.lineTotal)}
          </td>
        </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px 12px;background:#f6f7f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;">
    <tr>
      <td style="background:#2E7D32;padding:22px 24px;color:#ffffff;">
        <div style="font-size:18px;font-weight:700;">${escapeHtml(brand.siteName)}</div>
        <div style="font-size:13px;opacity:.9;margin-top:2px;">Order confirmed</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <p style="margin:0 0 4px;font-size:15px;color:#1f2320;">Hi ${escapeHtml(order.contactName)},</p>
        <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.55;">
          Thanks for your order — we've got it. Pay when you collect; no card details needed.
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f5;border-radius:10px;">
          <tr>
            <td style="padding:14px 16px;font-size:13px;color:#4b5563;">
              <strong style="color:#1f2320;">Order number</strong><br />${escapeHtml(order.orderNo)}
            </td>
            <td style="padding:14px 16px;font-size:13px;color:#4b5563;">
              <strong style="color:#1f2320;">Collect</strong><br />${escapeHtml(when)}
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
          ${rows}
          <tr>
            <td style="padding:12px 0 0;font-size:14px;color:#4b5563;">Subtotal</td>
            <td align="right" style="padding:12px 0 0;font-size:14px;color:#1f2320;">${money(order.subtotal)}</td>
          </tr>
          ${
            discount > 0
              ? `<tr>
            <td style="padding:6px 0 0;font-size:14px;color:#4b5563;">Discount${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ""}</td>
            <td align="right" style="padding:6px 0 0;font-size:14px;color:#2E7D32;">−${money(discount)}</td>
          </tr>`
              : ""
          }
          <tr>
            <td style="padding:10px 0 0;font-size:16px;font-weight:700;color:#1f2320;border-top:2px solid #1f2320;">Total</td>
            <td align="right" style="padding:10px 0 0;font-size:16px;font-weight:700;color:#1f2320;border-top:2px solid #1f2320;">${money(order.total)}</td>
          </tr>
        </table>

        ${
          order.notes
            ? `<p style="margin:20px 0 0;padding:12px 14px;background:#f6f7f5;border-radius:10px;font-size:13px;color:#4b5563;">
                 <strong style="color:#1f2320;">Your note:</strong> ${escapeHtml(order.notes)}
               </p>`
            : ""
        }

        ${
          brand.address
            ? `<p style="margin:20px 0 0;font-size:13px;color:#4b5563;line-height:1.55;">
                 <strong style="color:#1f2320;">Pick up from</strong><br />${escapeHtml(brand.address)}
                 ${brand.pickupNote ? `<br /><span style="color:#6b7280;">${escapeHtml(brand.pickupNote)}</span>` : ""}
               </p>`
            : ""
        }

        ${
          trackUrl
            ? `<p style="margin:22px 0 0;">
                 <a href="${trackUrl}" style="display:inline-block;background:#2E7D32;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:9px;font-size:14px;font-weight:600;">Track this order</a>
               </p>
               <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">You'll need your order number and phone number.</p>`
            : ""
        }
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px 24px;border-top:1px solid #ececec;font-size:12px;color:#6b7280;line-height:1.6;">
        Need to change something? ${brand.phone ? `Call us on ${escapeHtml(brand.phone)}.` : "Give us a call."}<br />
        This is a receipt for order ${escapeHtml(order.orderNo)} — you don't need to reply.
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `${brand.siteName} — order confirmed`,
    "",
    `Hi ${order.contactName},`,
    "Thanks for your order. Pay when you collect.",
    "",
    `Order number: ${order.orderNo}`,
    `Collect: ${when}`,
    "",
    ...order.items.map(
      (item) =>
        `  ${item.quantity} × ${item.nameSnapshot}${item.variantSnapshot ? ` (${item.variantSnapshot})` : ""} — ${money(item.lineTotal)}`,
    ),
    "",
    `Subtotal: ${money(order.subtotal)}`,
    ...(discount > 0
      ? [`Discount${order.couponCode ? ` (${order.couponCode})` : ""}: -${money(discount)}`]
      : []),
    `Total: ${money(order.total)}`,
    ...(order.notes ? ["", `Your note: ${order.notes}`] : []),
    ...(brand.address ? ["", `Pick up from: ${brand.address}`] : []),
    ...(brand.pickupNote ? [brand.pickupNote] : []),
    ...(trackUrl ? ["", `Track your order: ${trackUrl}`] : []),
    ...(brand.phone ? ["", `Need to change something? Call ${brand.phone}.`] : []),
  ].join("\n");

  return {
    to: order.contactEmail!,
    subject: `Order ${order.orderNo} confirmed — ${brand.siteName}`,
    html,
    text,
  };
}

/**
 * Customer-supplied strings go into the HTML body, so they are escaped rather
 * than trusted. A name containing `<` is a rendering bug at best; in a mail
 * client that runs any of it, it is worse.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
