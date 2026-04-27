alter table public.inventory_items
  drop constraint if exists inventory_items_product_id_location_id_key;

alter table public.inventory_items
  drop column if exists location_id;

drop table if exists public.inventory_locations cascade;

delete from public.inventory_items
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by product_id
        order by updated_at desc, id desc
      ) as row_number
    from public.inventory_items
  ) ranked_inventory
  where row_number > 1
);

alter table public.inventory_items
  add constraint inventory_items_product_id_key unique (product_id);
