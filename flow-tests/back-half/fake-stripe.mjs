// A stand-in for the `stripe` SDK, swapped in by hooks.mjs. It records what
// create-checkout-session asks Stripe to build (the metadata is the whole
// point) and hands the webhook back whatever event the test posts, without
// signature checking -- the test is about what the code does with an event,
// not about Stripe's crypto.
globalThis.__stripe = { sessions: [] };
export default class Stripe {
  constructor() {
    this.checkout = { sessions: { create: async (args) => {
      const id = `cs_test_${globalThis.__stripe.sessions.length + 1}`;
      const session = { id, url: `https://checkout.stripe.test/${id}`, ...args };
      globalThis.__stripe.sessions.push(session);
      return session;
    } } };
    this.webhooks = { constructEvent: (rawBody) => JSON.parse(rawBody.toString()) };
  }
}
