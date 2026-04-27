create schema if not exists extensions;
set search_path = public, extensions;

create extension if not exists pgcrypto with schema extensions;

create type public.app_user_role as enum ('customer', 'staff', 'admin');
create type public.product_status as enum ('draft', 'active', 'archived');
create type public.cart_status as enum ('active', 'converted', 'abandoned');
create type public.order_status as enum ('pending', 'confirmed', 'processing', 'completed', 'cancelled', 'refunded');
create type public.payment_status as enum ('unpaid', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed');
create type public.fulfillment_status as enum ('unfulfilled', 'partial', 'fulfilled', 'returned');
create type public.discount_type as enum ('percentage', 'fixed_amount', 'free_shipping');
create type public.review_status as enum ('pending', 'approved', 'rejected');

create sequence if not exists public.order_number_seq start 1000;

create or replace function public.generate_order_number()
returns text
language plpgsql
as $$
begin
  return 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
end;
$$;

create table public.shop_settings (
  id boolean primary key default true,
  business_name text not null,
  brand_name text not null,
  slug text not null unique,
  default_currency char(3) not null default 'USD',
  support_email text,
  support_phone text,
  logo_url text,
  favicon_url text,
  website_url text,
  business_address jsonb not null default '{}'::jsonb,
  social_links jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_settings_singleton check (id),
  constraint shop_settings_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint shop_settings_currency_format check (default_currency ~ '^[A-Z]{3}$')
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_user_role not null default 'customer',
  full_name text,
  email text,
  phone text,
  avatar_url text,
  preferences jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text,
  full_name text not null,
  phone text,
  company text,
  line1 text not null,
  line2 text,
  city text not null,
  region text,
  postal_code text not null,
  country_code char(2) not null,
  is_default_shipping boolean not null default false,
  is_default_billing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint addresses_country_code_format check (country_code ~ '^[A-Z]{2}$')
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug),
  constraint categories_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint categories_no_self_parent check (id <> parent_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  subtitle text,
  description text,
  status public.product_status not null default 'draft',
  is_featured boolean not null default false,
  sku text unique,
  price numeric(12, 2) not null default 0,
  compare_at_price numeric(12, 2),
  cost numeric(12, 2),
  currency char(3) not null default 'USD',
  attributes jsonb not null default '{}'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug),
  constraint products_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint products_price_non_negative check (price >= 0),
  constraint products_compare_price_non_negative check (compare_at_price is null or compare_at_price >= 0),
  constraint products_cost_non_negative check (cost is null or cost >= 0),
  constraint products_currency_format check (currency ~ '^[A-Z]{3}$')
);

create table public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (product_id, category_id)
);

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt_text text,
  media_type text not null default 'image',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint product_media_type_check check (media_type in ('image', 'video', 'model'))
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 0,
  reserved_quantity integer not null default 0,
  low_stock_threshold integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (product_id),
  constraint inventory_items_quantity_non_negative check (quantity >= 0),
  constraint inventory_items_reserved_non_negative check (reserved_quantity >= 0),
  constraint inventory_items_reserved_within_quantity check (reserved_quantity <= quantity)
);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  session_id text,
  status public.cart_status not null default 'active',
  currency char(3) not null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carts_owner_check check (user_id is not null or session_id is not null),
  constraint carts_currency_format check (currency ~ '^[A-Z]{3}$')
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 1,
  unit_price numeric(12, 2) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id),
  constraint cart_items_quantity_positive check (quantity > 0),
  constraint cart_items_unit_price_non_negative check (unit_price >= 0)
);

create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  type public.discount_type not null,
  value numeric(12, 2) not null default 0,
  minimum_subtotal numeric(12, 2),
  usage_limit integer,
  per_customer_limit integer,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code),
  constraint discounts_value_non_negative check (value >= 0),
  constraint discounts_minimum_non_negative check (minimum_subtotal is null or minimum_subtotal >= 0),
  constraint discounts_usage_limit_positive check (usage_limit is null or usage_limit > 0),
  constraint discounts_customer_limit_positive check (per_customer_limit is null or per_customer_limit > 0),
  constraint discounts_dates_order check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default public.generate_order_number(),
  customer_id uuid references public.profiles(id) on delete set null,
  email text not null,
  phone text,
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',
  fulfillment_status public.fulfillment_status not null default 'unfulfilled',
  currency char(3) not null default 'USD',
  subtotal_amount numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  shipping_amount numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  billing_address jsonb not null,
  shipping_address jsonb not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  placed_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint orders_amounts_non_negative check (
    subtotal_amount >= 0 and discount_amount >= 0 and shipping_amount >= 0 and tax_amount >= 0 and total_amount >= 0
  )
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_title text not null,
  sku text,
  quantity integer not null,
  unit_price numeric(12, 2) not null,
  discount_amount numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_amounts_non_negative check (
    unit_price >= 0 and discount_amount >= 0 and tax_amount >= 0 and total_amount >= 0
  )
);

create table public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.discounts(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (discount_id, order_id),
  constraint discount_redemptions_amount_non_negative check (amount >= 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  provider_payment_id text,
  status public.payment_status not null default 'unpaid',
  amount numeric(12, 2) not null,
  currency char(3) not null default 'USD',
  raw_response jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_non_negative check (amount >= 0),
  constraint payments_currency_format check (currency ~ '^[A-Z]{3}$')
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  carrier text,
  service text,
  tracking_number text,
  tracking_url text,
  status text not null default 'pending',
  shipped_at timestamptz,
  delivered_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipment_items (
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  quantity integer not null,
  primary key (shipment_id, order_item_id),
  constraint shipment_items_quantity_positive check (quantity > 0)
);

create table public.returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  status text not null default 'requested',
  reason text,
  refund_amount numeric(12, 2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint returns_refund_amount_non_negative check (refund_amount >= 0)
);

create table public.return_items (
  return_id uuid not null references public.returns(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  quantity integer not null,
  condition text,
  primary key (return_id, order_item_id),
  constraint return_items_quantity_positive check (quantity > 0)
);

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Wishlist',
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wishlist_items (
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wishlist_id, product_id)
);

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete set null,
  rating integer not null,
  title text,
  body text,
  status public.review_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_reviews_rating_range check (rating between 1 and 5),
  unique (product_id, user_id, order_item_id)
);

create table public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code char(2) not null,
  region text,
  rate numeric(6, 5) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_rates_country_code_format check (country_code ~ '^[A-Z]{2}$'),
  constraint tax_rates_rate_range check (rate >= 0 and rate <= 1)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_user_role()
returns public.app_user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'customer'::public.app_user_role);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('staff', 'admin');
$$;

create trigger set_shop_settings_updated_at before update on public.shop_settings for each row execute function public.set_updated_at();
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_addresses_updated_at before update on public.addresses for each row execute function public.set_updated_at();
create trigger set_categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger set_products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger set_inventory_items_updated_at before update on public.inventory_items for each row execute function public.set_updated_at();
create trigger set_carts_updated_at before update on public.carts for each row execute function public.set_updated_at();
create trigger set_cart_items_updated_at before update on public.cart_items for each row execute function public.set_updated_at();
create trigger set_discounts_updated_at before update on public.discounts for each row execute function public.set_updated_at();
create trigger set_orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger set_payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger set_shipments_updated_at before update on public.shipments for each row execute function public.set_updated_at();
create trigger set_returns_updated_at before update on public.returns for each row execute function public.set_updated_at();
create trigger set_wishlists_updated_at before update on public.wishlists for each row execute function public.set_updated_at();
create trigger set_product_reviews_updated_at before update on public.product_reviews for each row execute function public.set_updated_at();
create trigger set_tax_rates_updated_at before update on public.tax_rates for each row execute function public.set_updated_at();

create index addresses_user_id_idx on public.addresses(user_id);
create index categories_parent_id_idx on public.categories(parent_id);
create index products_status_idx on public.products(status);
create index product_categories_category_id_idx on public.product_categories(category_id);
create index product_media_product_sort_idx on public.product_media(product_id, sort_order);
create index inventory_items_product_id_idx on public.inventory_items(product_id);
create index carts_user_status_idx on public.carts(user_id, status);
create index carts_session_status_idx on public.carts(session_id, status);
create index cart_items_cart_id_idx on public.cart_items(cart_id);
create index orders_customer_id_idx on public.orders(customer_id);
create index orders_status_idx on public.orders(status);
create index order_items_order_id_idx on public.order_items(order_id);
create index payments_order_id_idx on public.payments(order_id);
create index shipments_order_id_idx on public.shipments(order_id);
create index returns_order_id_idx on public.returns(order_id);
create index wishlists_user_id_idx on public.wishlists(user_id);
create index product_reviews_product_status_idx on public.product_reviews(product_id, status);
create index tax_rates_country_idx on public.tax_rates(country_code, region);

alter table public.shop_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_media enable row level security;
alter table public.inventory_items enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.discounts enable row level security;
alter table public.discount_redemptions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_items enable row level security;
alter table public.returns enable row level security;
alter table public.return_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.product_reviews enable row level security;
alter table public.tax_rates enable row level security;

create policy "Public can read active shop settings" on public.shop_settings for select using (is_active);
create policy "Staff can manage shop settings" on public.shop_settings for all using (public.is_staff()) with check (public.is_staff());

create policy "Users can read own profile" on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy "Users can insert own profile" on public.profiles for insert with check (id = auth.uid());
create policy "Users can update own profile" on public.profiles for update using (id = auth.uid() or public.is_staff()) with check (id = auth.uid() or public.is_staff());

create policy "Users can manage own addresses" on public.addresses for all using (user_id = auth.uid() or public.is_staff()) with check (user_id = auth.uid() or public.is_staff());

create policy "Public can read active categories" on public.categories for select using (is_active);
create policy "Staff can manage categories" on public.categories for all using (public.is_staff()) with check (public.is_staff());

create policy "Public can read active products" on public.products for select using (status = 'active');
create policy "Staff can manage products" on public.products for all using (public.is_staff()) with check (public.is_staff());

create policy "Public can read product categories" on public.product_categories for select using (true);
create policy "Staff can manage product categories" on public.product_categories for all using (public.is_staff()) with check (public.is_staff());

create policy "Public can read product media" on public.product_media for select using (true);
create policy "Staff can manage product media" on public.product_media for all using (public.is_staff()) with check (public.is_staff());

create policy "Staff can manage inventory items" on public.inventory_items for all using (public.is_staff()) with check (public.is_staff());

create policy "Users can manage own carts" on public.carts for all using (user_id = auth.uid() or public.is_staff()) with check (user_id = auth.uid() or public.is_staff());
create policy "Users can manage own cart items" on public.cart_items for all
  using (exists (select 1 from public.carts where carts.id = cart_items.cart_id and (carts.user_id = auth.uid() or public.is_staff())))
  with check (exists (select 1 from public.carts where carts.id = cart_items.cart_id and (carts.user_id = auth.uid() or public.is_staff())));

create policy "Public can read active discounts" on public.discounts for select using (is_active);
create policy "Staff can manage discounts" on public.discounts for all using (public.is_staff()) with check (public.is_staff());
create policy "Staff can read discount redemptions" on public.discount_redemptions for select using (public.is_staff());

create policy "Users can read own orders" on public.orders for select using (customer_id = auth.uid() or public.is_staff());
create policy "Staff can manage orders" on public.orders for all using (public.is_staff()) with check (public.is_staff());
create policy "Users can read own order items" on public.order_items for select
  using (exists (select 1 from public.orders where orders.id = order_items.order_id and (orders.customer_id = auth.uid() or public.is_staff())));
create policy "Staff can manage order items" on public.order_items for all using (public.is_staff()) with check (public.is_staff());

create policy "Users can read own payments" on public.payments for select
  using (exists (select 1 from public.orders where orders.id = payments.order_id and (orders.customer_id = auth.uid() or public.is_staff())));
create policy "Staff can manage payments" on public.payments for all using (public.is_staff()) with check (public.is_staff());

create policy "Users can read own shipments" on public.shipments for select
  using (exists (select 1 from public.orders where orders.id = shipments.order_id and (orders.customer_id = auth.uid() or public.is_staff())));
create policy "Staff can manage shipments" on public.shipments for all using (public.is_staff()) with check (public.is_staff());
create policy "Users can read own shipment items" on public.shipment_items for select
  using (exists (
    select 1
    from public.shipments
    join public.orders on orders.id = shipments.order_id
    where shipments.id = shipment_items.shipment_id and (orders.customer_id = auth.uid() or public.is_staff())
  ));
create policy "Staff can manage shipment items" on public.shipment_items for all using (public.is_staff()) with check (public.is_staff());

create policy "Users can read own returns" on public.returns for select using (customer_id = auth.uid() or public.is_staff());
create policy "Users can create own returns" on public.returns for insert with check (customer_id = auth.uid() or public.is_staff());
create policy "Staff can manage returns" on public.returns for all using (public.is_staff()) with check (public.is_staff());
create policy "Users can read own return items" on public.return_items for select
  using (exists (select 1 from public.returns where returns.id = return_items.return_id and (returns.customer_id = auth.uid() or public.is_staff())));
create policy "Staff can manage return items" on public.return_items for all using (public.is_staff()) with check (public.is_staff());

create policy "Users can manage own wishlists" on public.wishlists for all using (user_id = auth.uid() or public.is_staff()) with check (user_id = auth.uid() or public.is_staff());
create policy "Users can manage own wishlist items" on public.wishlist_items for all
  using (exists (select 1 from public.wishlists where wishlists.id = wishlist_items.wishlist_id and (wishlists.user_id = auth.uid() or public.is_staff())))
  with check (exists (select 1 from public.wishlists where wishlists.id = wishlist_items.wishlist_id and (wishlists.user_id = auth.uid() or public.is_staff())));

create policy "Public can read approved reviews" on public.product_reviews for select using (status = 'approved' or user_id = auth.uid() or public.is_staff());
create policy "Users can create own reviews" on public.product_reviews for insert with check (user_id = auth.uid());
create policy "Users can update own pending reviews" on public.product_reviews for update using (user_id = auth.uid() and status = 'pending') with check (user_id = auth.uid() and status = 'pending');
create policy "Staff can manage reviews" on public.product_reviews for all using (public.is_staff()) with check (public.is_staff());

create policy "Public can read active tax rates" on public.tax_rates for select using (is_active);
create policy "Staff can manage tax rates" on public.tax_rates for all using (public.is_staff()) with check (public.is_staff());
