# Go live — the checklist

Everything on this page happens in dashboards only Alyx can open. Fifteen
minutes end to end. Do the steps in order; the shop goes live at step 5.

## 0. Confirm the starting state (optional, free)

    bash flow-tests/go-live-probe.sh

Expected: `STRIPE MODE: TEST`, webhook `400`. That is the safe state.

## 1. Supabase — the ledger tables (2 min)

1. Open the project → **SQL Editor** → **New query**.
2. Paste the whole of [`supabase/flyer-ledger.sql`](supabase/flyer-ledger.sql).
3. **Run**. It only adds two tables and three optional columns; nothing
   existing changes. Re-running it is harmless (`if not exists` throughout).
4. Check: on [admin.html](https://muggshotz-ai-test.vercel.app/admin.html) the
   Commissions card no longer says "tables not created yet".

## 2. Stripe — the live webhook (4 min)

1. In Stripe, switch the **Test mode** toggle (top right) **OFF**.
2. **Developers → Webhooks → Add endpoint**.
   - Endpoint URL: `https://muggshotz-ai-test.vercel.app/api/stripe-webhook`
   - Events: `checkout.session.completed` (the only one the code handles).
3. Open the new endpoint → **Reveal** the *Signing secret* (`whsec_…`). Keep
   the tab open; you paste it in step 4.

## 3. Stripe — the live secret key (1 min)

**Developers → API keys** (Test mode still OFF) → copy the **Secret key**
(`sk_live_…`). Never the publishable one.

## 4. Vercel — swap the two variables (5 min)

**Project → Settings → Environment Variables**, environment *Production*:

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | the `sk_live_…` from step 3 |
| `STRIPE_WEBHOOK_SECRET` | the `whsec_…` from step 2 |

While there, confirm `PRINTIFY_API_TOKEN` is the token from the **real**
shop's Printify account (Printify → My profile → Connections → API tokens).

Then **Deployments → ⋯ on the latest → Redeploy**. Wait for it to finish.

## 5. Confirm the flip (free)

    bash flow-tests/go-live-probe.sh

Expected now: `STRIPE MODE: LIVE`, webhook still `400`. From this moment a
completed checkout charges a real card and places a real Printify order.

## 6. The first order

Make it yourself, on your phone, for something cheap and flat (the mouse
pad). Watch three things, in this order:

1. The Stripe page has **no** orange TEST MODE badge.
2. After paying, the order appears in **Printify → Orders** within a minute,
   with the right product, size and picture. (Vercel → the project →
   **Logs** shows `Order placed successfully for session …` if you want the
   receipt from the code's side, or the reason if it did not.)
3. The email confirmation arrives.

If step 2 fails, do not order again — send Claude the log line and the
order stays a one-off to fix.

## Rolling back

Put the `sk_test_…` key and the test `whsec_…` back in Vercel and redeploy.
The webhook then discards every completion again; nothing can be charged or
printed.
