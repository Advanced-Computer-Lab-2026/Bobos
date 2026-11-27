export function mockStripeCheckout(t) {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
  t.after(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  });
  const fetch = globalThis.fetch;
  let checkout;
  let sequence = 0;
  t.mock.method(globalThis, "fetch", (url, options) => {
    if (!String(url).startsWith("https://api.stripe.com/v1/checkout/sessions")) return fetch(url, options);
    if (String(url).endsWith("/expire")) Object.assign(checkout, { status: "expired", payment_intent: null });
    else if (options.method === "POST") {
      const id = `cs_test_${++sequence}`;
      checkout = {
        id, url: `https://checkout.stripe.com/c/pay/${id}`, status: "open", payment_status: "unpaid",
        livemode: false, currency: "egp", amount_total: Number(options.body.get("line_items[0][price_data][unit_amount]")),
        client_reference_id: options.body.get("client_reference_id"),
      };
    }
    return Promise.resolve(Response.json(checkout));
  });
  return {
    fail: () => Object.assign(checkout, { payment_intent: { last_payment_error: { code: "card_declined" } } }),
    pay: () => Object.assign(checkout, { status: "complete", payment_status: "paid", payment_intent: { id: "pi_receipt" } }),
  };
}
