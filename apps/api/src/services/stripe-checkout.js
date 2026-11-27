const stripeOrigin = "https://api.stripe.com/v1/checkout/sessions";

export function stripeCheckoutConfigured() {
  return /^sk_test_\w+$/.test(process.env.STRIPE_SECRET_KEY || "");
}

async function stripeRequest(path, { body, idempotencyKey } = {}) {
  if (!stripeCheckoutConfigured()) {
    throw Object.assign(new Error("Card payments are temporarily unavailable."), { status: 503 });
  }
  const response = await fetch(stripeOrigin + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Stripe-Version": "2026-11-18.endive",
      ...(idempotencyKey && { "Idempotency-Key": idempotencyKey }),
    },
    body,
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const { error } = await response.json().catch(() => ({}));
    throw Object.assign(new Error("Stripe could not confirm this checkout. Please try again."), {
      status: 502, stripeStatus: response.status, stripeErrorType: error?.type,
    });
  }
  return response.json();
}

export function createStripeCheckout(attempt) {
  const origin = (process.env.WEB_ORIGIN || "http://localhost:5173").split(",")[0].trim();
  const portal = new URL("/portal-studio/index.html", origin);
  portal.search = new URLSearchParams({
    page: "extra-hours", role: "advisingStudent", preview: "live",
    stripeRequest: String(attempt.extraHoursRequest), stripeAttempt: attempt.id,
  });
  portal.searchParams.set("stripeReturn", "success");
  const successUrl = portal.href;
  portal.searchParams.set("stripeReturn", "cancel");
  return stripeRequest("", {
    idempotencyKey: `bobos-extra-hours-${attempt.id}`,
    body: new URLSearchParams({
      mode: "payment",
      success_url: successUrl,
      cancel_url: portal.href,
      client_reference_id: attempt.id,
      "allowed_payment_method_types[0]": "card",
      "line_items[0][price_data][currency]": "egp",
      "line_items[0][price_data][unit_amount]": String(Math.round(attempt.amount * 100)),
      "line_items[0][price_data][product_data][name]": "Bobos extra credit hours",
      "line_items[0][quantity]": "1",
      "adaptive_pricing[enabled]": "false",
    }),
  });
}

export function getStripeCheckout(id) {
  return stripeRequest(`/${encodeURIComponent(id)}?expand[]=payment_intent`);
}

export function expireStripeCheckout(id) {
  return stripeRequest(`/${encodeURIComponent(id)}/expire`, { body: new URLSearchParams() });
}
