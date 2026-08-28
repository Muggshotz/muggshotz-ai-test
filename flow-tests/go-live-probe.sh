#!/usr/bin/env bash
# GO-LIVE PROBE — one command, zero cost, tells you which mode the shop is in.
#
# Run it BEFORE flipping keys to confirm the starting state, and AFTER the
# Vercel env swap to confirm the flip took. It creates one unpaid Stripe
# checkout session (they expire on their own) and knocks on the webhook.
#
#   bash flow-tests/go-live-probe.sh
#
# Expected before the flip:  STRIPE MODE: TEST
# Expected after the flip:   STRIPE MODE: LIVE
# The webhook line should read 400 in both worlds -- that is the endpoint
# refusing an unsigned caller, which is exactly its job. Anything else
# (404, 500) means the endpoint or its secret is misconfigured.
SITE="https://muggshotz-ai-test.vercel.app"

echo "== Stripe mode =="
MODE=$(curl -s --max-time 45 -X POST "$SITE/api/create-checkout-session" \
  -H "Content-Type: application/json" \
  -d '{"type":"token_purchase","deviceId":"go-live-probe","packId":"1token"}' \
  | grep -oE "cs_(test|live)_" | head -1)
case "$MODE" in
  cs_live_) echo "STRIPE MODE: LIVE — real cards will be charged, webhook will place real Printify orders" ;;
  cs_test_) echo "STRIPE MODE: TEST — test cards only, webhook ignores completions, nothing can be printed or charged" ;;
  *)        echo "STRIPE MODE: UNKNOWN — session creation failed; check STRIPE_SECRET_KEY in Vercel and the deploy logs" ;;
esac

echo "== Webhook endpoint =="
CODE=$(curl -s --max-time 30 -o /dev/null -w "%{http_code}" -X POST "$SITE/api/stripe-webhook" \
  -H "Content-Type: application/json" -d '{}')
if [ "$CODE" = "400" ]; then
  echo "WEBHOOK: deployed and guarding (rejected an unsigned caller with 400 — correct)"
else
  echo "WEBHOOK: unexpected response $CODE — investigate before going live"
fi

echo "== Printify =="
if curl -s --max-time 30 "$SITE/api/admin?action=printify-catalog&path=catalog/blueprints/1498/print_providers.json" | grep -q '"id":217'; then
  echo "PRINTIFY: live and answering (blueprint 1498 provider confirmed)"
else
  echo "PRINTIFY: catalog read failed — check PRINTIFY token before going live"
fi
