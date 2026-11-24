-- Hits & Licks: gold bars bought through Stripe Checkout.
-- The Edge Function "pay" writes a row when Stripe confirms a payment (signed webhook); the Edge Function "game"
-- adds the bars to the player's save on the next sync and sets credited_at. Only the service role touches it.
-- Stripe keeps the full payment records (receipts, VAT, refunds); this table only says what to credit to whom.

create table if not exists public.purchases (
  id text primary key,                 -- Stripe Checkout Session id (cs_...): one payment, never credited twice
  -- a deleted account keeps its payment records (10 years, accounting law), only without the link to the player
  user_id uuid references auth.users (id) on delete set null,
  bars int not null check (bars > 0),
  amount int not null,                 -- what the player paid, in cents, VAT included
  currency text not null,
  payment_intent text,
  livemode boolean not null default false,
  status text not null default 'paid', -- paid | refunded | disputed (recorded only; bars are not taken back)
  credited_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists purchases_to_credit_idx on public.purchases (user_id) where credited_at is null;
create index if not exists purchases_payment_intent_idx on public.purchases (payment_intent);

alter table public.purchases enable row level security;
-- no policies on purpose: only the server (service role) reads and writes it
