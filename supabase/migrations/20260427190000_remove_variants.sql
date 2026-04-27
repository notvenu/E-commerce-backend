alter table public.products
  add column if not exists sku text,
  add column if not exists price numeric(12, 2) not null default 0,
  add column if not exists compare_at_price numeric(12, 2),
  add column if not exists cost numeric(12, 2),
  add column if not exists currency char(3) not null default 'USD';

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'product_variants'
  ) then
    execute $sql$
      with variant_source as (
        select distinct on (pv.product_id)
          pv.product_id,
          pv.sku,
          pv.price,
          pv.compare_at_price,
          pv.cost,
          pv.currency
        from public.product_variants pv
        order by pv.product_id, pv.is_default desc, pv.created_at asc, pv.id asc
      )
      update public.products p
      set
        sku = coalesce(p.sku, v.sku),
        price = coalesce(v.price, p.price),
        compare_at_price = coalesce(v.compare_at_price, p.compare_at_price),
        cost = coalesce(v.cost, p.cost),
        currency = coalesce(v.currency, p.currency)
      from variant_source v
      where p.id = v.product_id
    $sql$;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_sku_key'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products add constraint products_sku_key unique (sku);
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'product_media' and column_name = 'variant_id'
  ) then
    alter table public.product_media drop column variant_id;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'inventory_items' and column_name = 'variant_id'
  ) then
    execute $sql$
      create table public.inventory_items_new (
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
      )
    $sql$;

    execute $sql$
      insert into public.inventory_items_new (product_id, quantity, reserved_quantity, low_stock_threshold, updated_at)
      select
        pv.product_id,
        sum(ii.quantity)::integer as quantity,
        sum(ii.reserved_quantity)::integer as reserved_quantity,
        max(ii.low_stock_threshold)::integer as low_stock_threshold,
        max(ii.updated_at) as updated_at
      from public.inventory_items ii
      join public.product_variants pv on pv.id = ii.variant_id
      group by pv.product_id
    $sql$;

    drop table public.inventory_items;
    alter table public.inventory_items_new rename to inventory_items;
    create trigger set_inventory_items_updated_at before update on public.inventory_items for each row execute function public.set_updated_at();
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'cart_items' and column_name = 'variant_id'
  ) then
    execute $sql$
      create table public.cart_items_new (
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
      )
    $sql$;

    execute $sql$
      insert into public.cart_items_new (cart_id, product_id, quantity, unit_price, metadata, created_at, updated_at)
      select
        ci.cart_id,
        pv.product_id,
        sum(ci.quantity)::integer as quantity,
        max(ci.unit_price) as unit_price,
        '{}'::jsonb as metadata,
        min(ci.created_at) as created_at,
        max(ci.updated_at) as updated_at
      from public.cart_items ci
      join public.product_variants pv on pv.id = ci.variant_id
      group by ci.cart_id, pv.product_id
    $sql$;

    drop table public.cart_items;
    alter table public.cart_items_new rename to cart_items;
    create trigger set_cart_items_updated_at before update on public.cart_items for each row execute function public.set_updated_at();
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items' and column_name = 'variant_id'
  ) then
    alter table public.order_items drop column variant_id;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items' and column_name = 'variant_title'
  ) then
    alter table public.order_items drop column variant_title;
  end if;
end;
$$;

drop table if exists public.product_variants cascade;

drop index if exists public.product_variants_product_id_idx;
drop index if exists public.inventory_items_variant_id_idx;
create index if not exists inventory_items_product_id_idx on public.inventory_items(product_id);
