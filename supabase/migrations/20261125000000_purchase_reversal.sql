-- Hits & Licks: a payment refunded by Lucky or charged back through the bank takes its bars back on the player's
-- next sync (js/api.js reversedPurchases, never below zero). reversed_at marks it done; the pay webhook only changes
-- status, so a second refund or dispute event for the same payment never takes the bars twice.
alter table public.purchases add column if not exists reversed_at timestamptz;
create index if not exists purchases_to_reverse_idx on public.purchases (user_id) where status <> 'paid' and reversed_at is null;
