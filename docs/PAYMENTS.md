# Payments

- Stripe only on the server (`src/lib/payments.ts`); card data never touches Kora (Stripe Checkout + Customer Portal).
- `subscription_plans` rows are seeded **inactive with no prices**. Pricing is a business decision: set `price_cents`, `currency`, `stripe_price_id`, then `is_active = true`.
- Checkout: `/provider/billing` → `startCheckoutAction` (user id + plan in metadata).
- Webhook `/api/stripe/webhook`: signature-verified on the raw body, idempotent via `stripe_events`, upserts `subscriptions` and `payments` with the service role, audited.
- Patients are never charged by Kora. Appointment-related fees are out of scope until legal review per jurisdiction.
- Entitlements (what a plan unlocks) are not yet enforced — early access is free for all providers.
