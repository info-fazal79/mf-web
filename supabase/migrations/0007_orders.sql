-- =====================================================================
-- MF Website · Migration 0007 · Orders, coupons & bKash/Nagad payments (Phase 8)
-- Run AFTER 0006. Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- If Supabase shows a Row Level Security warning, choose "Run without RLS".
--
-- Flow: buyer sends money with bKash/Nagad "Send Money" → enters sender
-- number + Transaction ID at checkout → order is "pending" → admin checks
-- the bKash/Nagad app and clicks Approve → books unlock in the library.
-- Prices are always calculated in the database, never trusted from the browser.
-- =====================================================================

-- ---------- Coupons ----------
create table if not exists public.coupons (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,30}$'),
  kind        text not null default 'percent' check (kind in ('percent', 'fixed')),
  value       numeric(10, 2) not null check (value > 0),
  min_total   numeric(10, 2) not null default 0,
  max_uses    int,
  used_count  int not null default 0,
  starts_at   timestamptz,
  ends_at     timestamptz,
  ebook_ids   uuid[],                      -- null = all e-books
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.coupons enable row level security;
drop policy if exists "coupons: admin all" on public.coupons;
create policy "coupons: admin all" on public.coupons for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Orders ----------
create sequence if not exists public.order_no_seq start 1001;

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_no        text not null unique default ('MF-' || nextval('public.order_no_seq')),
  user_id         uuid not null references auth.users (id) on delete cascade,
  email           text not null,
  name            text,
  phone           text,
  items           jsonb not null,           -- [{ebook_id, title, slug, price}]
  subtotal        numeric(10, 2) not null,
  discount        numeric(10, 2) not null default 0,
  total           numeric(10, 2) not null,
  coupon_code     text,
  payment_method  text check (payment_method in ('bkash', 'nagad', 'free')),
  payer_number    text,
  trx_id          text,
  status          text not null default 'pending' check (status in ('pending', 'paid', 'rejected', 'refunded', 'cancelled')),
  admin_note      text,
  created_at      timestamptz not null default now(),
  paid_at         timestamptz
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);
create unique index if not exists orders_trx_uniq on public.orders (payment_method, upper(trx_id)) where trx_id is not null and status <> 'rejected';

alter table public.orders enable row level security;
drop policy if exists "orders: own read" on public.orders;
create policy "orders: own read" on public.orders for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "orders: admin all" on public.orders;
create policy "orders: admin all" on public.orders for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Pricing helper ----------
create or replace function public.quote_order(p_items uuid[], p_coupon text default null)
returns table (subtotal numeric, discount numeric, total numeric, coupon_ok boolean, coupon_message text, items jsonb)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_items jsonb;
  v_sub numeric := 0;
  v_disc numeric := 0;
  c public.coupons;
  v_ok boolean := null;
  v_msg text := null;
  v_eligible numeric := 0;
begin
  select coalesce(jsonb_agg(jsonb_build_object('ebook_id', e.id, 'title', e.title, 'slug', e.slug,
           'price', case when e.sale_price is not null and e.sale_price < e.price then e.sale_price else e.price end) order by e.title), '[]'::jsonb),
         coalesce(sum(case when e.sale_price is not null and e.sale_price < e.price then e.sale_price else e.price end), 0)
    into v_items, v_sub
  from public.ebooks e
  where e.id = any(p_items) and e.status = 'published' and e.access_mode = 'paid'
    and not exists (select 1 from public.ebook_library l where l.ebook_id = e.id and l.user_id = auth.uid());

  if p_coupon is not null and length(trim(p_coupon)) > 0 then
    select * into c from public.coupons where code = upper(trim(p_coupon));
    if not found or not c.active then v_ok := false; v_msg := 'This coupon code is not valid.';
    elsif c.starts_at is not null and now() < c.starts_at then v_ok := false; v_msg := 'This coupon is not active yet.';
    elsif c.ends_at is not null and now() > c.ends_at then v_ok := false; v_msg := 'This coupon has expired.';
    elsif c.max_uses is not null and c.used_count >= c.max_uses then v_ok := false; v_msg := 'This coupon has been fully used.';
    elsif v_sub < c.min_total then v_ok := false; v_msg := 'Your total is below the minimum for this coupon (৳' || c.min_total || ').';
    else
      select coalesce(sum((x->>'price')::numeric), 0) into v_eligible
      from jsonb_array_elements(v_items) x
      where c.ebook_ids is null or (x->>'ebook_id')::uuid = any(c.ebook_ids);
      if v_eligible = 0 then v_ok := false; v_msg := 'This coupon does not apply to these e-books.';
      else
        v_disc := case when c.kind = 'percent' then round(v_eligible * least(c.value, 100) / 100, 0) else least(c.value, v_eligible) end;
        v_ok := true; v_msg := 'Coupon applied: ' || case when c.kind = 'percent' then c.value || '% off' else '৳' || c.value || ' off' end;
      end if;
    end if;
  end if;

  return query select v_sub, v_disc, greatest(v_sub - v_disc, 0), v_ok, v_msg, v_items;
end $$;
grant execute on function public.quote_order(uuid[], text) to authenticated;

-- ---------- Grant books for an order (internal) ----------
create or replace function public.fulfil_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  insert into public.ebook_library (user_id, ebook_id, source)
  select o.user_id, (x->>'ebook_id')::uuid, 'purchase' from jsonb_array_elements(o.items) x
  on conflict (user_id, ebook_id) do update set source = 'purchase';
  update public.orders set status = 'paid', paid_at = coalesce(paid_at, now()) where id = p_order;
  if o.coupon_code is not null and o.status <> 'paid' then
    update public.coupons set used_count = used_count + 1 where code = o.coupon_code;
  end if;
end $$;
revoke all on function public.fulfil_order(uuid) from public, anon, authenticated;

-- ---------- Place an order (signed-in buyers) ----------
create or replace function public.place_order(p_items uuid[], p_coupon text, p_method text, p_payer text, p_trx text, p_name text, p_phone text)
returns table (order_id uuid, order_no text, total numeric, status text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  q record;
  v_email text;
  v_id uuid;
  v_no text;
  v_trx text := nullif(upper(trim(coalesce(p_trx, ''))), '');
begin
  if auth.uid() is null then raise exception 'Please sign in to place an order.'; end if;
  select * into q from public.quote_order(p_items, p_coupon);
  if q.items = '[]'::jsonb then raise exception 'Your cart has no purchasable e-books (you may already own them).'; end if;
  if q.coupon_ok = false then raise exception '%', q.coupon_message; end if;
  select email into v_email from auth.users where id = auth.uid();

  if q.total > 0 then
    if p_method not in ('bkash', 'nagad') then raise exception 'Choose bKash or Nagad.'; end if;
    if v_trx is null or v_trx !~ '^[A-Z0-9]{6,20}$' then raise exception 'Enter the Transaction ID from your payment message.'; end if;
    if coalesce(trim(p_payer), '') !~ '^(\+?88)?01[3-9][0-9]{8}$' then raise exception 'Enter the mobile number you paid from (e.g. 01XXXXXXXXX).'; end if;
    if exists (select 1 from public.orders o where o.payment_method = p_method and upper(o.trx_id) = v_trx and o.status <> 'rejected') then
      raise exception 'This Transaction ID has already been used.';
    end if;
  end if;

  insert into public.orders (user_id, email, name, phone, items, subtotal, discount, total, coupon_code, payment_method, payer_number, trx_id)
  values (auth.uid(), v_email, nullif(trim(p_name), ''), nullif(trim(p_phone), ''), q.items, q.subtotal, q.discount, q.total,
          case when q.coupon_ok then upper(trim(p_coupon)) end,
          case when q.total > 0 then p_method else 'free' end,
          case when q.total > 0 then trim(p_payer) end, v_trx)
  returning id, orders.order_no into v_id, v_no;

  if q.total = 0 then perform public.fulfil_order(v_id); end if;
  return query select v_id, v_no, q.total, (select o.status from public.orders o where o.id = v_id);
end $$;
grant execute on function public.place_order(uuid[], text, text, text, text, text, text) to authenticated;

-- ---------- Admin actions ----------
create or replace function public.approve_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  perform public.fulfil_order(p_order);
end $$;
grant execute on function public.approve_order(uuid) to authenticated;

create or replace function public.reject_order(p_order uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into o from public.orders where id = p_order;
  if o.status = 'paid' then
    delete from public.ebook_library l using jsonb_array_elements(o.items) x
    where l.user_id = o.user_id and l.ebook_id = (x->>'ebook_id')::uuid and l.source = 'purchase';
  end if;
  update public.orders set status = 'rejected', admin_note = coalesce(p_note, admin_note) where id = p_order;
end $$;
grant execute on function public.reject_order(uuid, text) to authenticated;

-- ---------- Default payment settings (edit numbers in Admin → Payments) ----------
insert into public.site_settings (key, value)
values ('payments', jsonb_build_object(
  'bkashEnabled', true, 'bkashNumber', '', 'bkashType', 'Personal',
  'nagadEnabled', true, 'nagadNumber', '', 'nagadType', 'Personal',
  'note', 'Use "Send Money", then copy the Transaction ID (TrxID) from the confirmation SMS.',
  'verifyHours', 6
))
on conflict (key) do nothing;
