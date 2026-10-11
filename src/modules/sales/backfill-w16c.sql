-- W16-C backfill for sale orders created before delivery notes existed.
-- Not a drizzle migration: paste into the migration that adds the W16-C columns, after they exist.
-- Idempotent: only lines still at delivered_qty = 0 and invoiced_qty = 0 are touched, and only on
-- confirmed or done orders with no live delivery. Re-running changes nothing.
-- Old draft stock moves are left alone.

-- 1. Delivered and invoiced quantities per order line.
--    delivered_qty: done stock moves from the order to a customer location, per product.
--    invoiced_qty:  quantities on posted invoices created from the order, per product.
--    Both are capped at the ordered quantity.
update sale_order_lines l
set
  delivered_qty = least(
    l.quantity,
    coalesce((
      select sum(m.quantity)
      from stock_moves m
      join stock_locations tl on tl.id = m.to_location_id and tl.company_id = m.company_id and tl.type = 'customer'
      where m.company_id = l.company_id
        and m.source_entity = 'sales.order'
        and m.source_id = l.order_id
        and m.product_id = l.product_id
        and m.state = 'done'
    ), 0)
  ),
  invoiced_qty = least(
    l.quantity,
    coalesce((
      select sum(il.quantity)
      from invoice_lines il
      join invoices i on i.id = il.invoice_id and i.company_id = il.company_id
      where il.company_id = l.company_id
        and i.source_entity = 'sales.order'
        and i.source_id = l.order_id
        and i.state = 'posted'
        and il.product_id = l.product_id
    ), 0)
  ),
  updated_at = now()
where l.product_id is not null
  and l.delivered_qty = 0
  and l.invoiced_qty = 0
  and exists (
    select 1 from sale_orders o
    where o.id = l.order_id
      and o.company_id = l.company_id
      and o.state in ('confirmed', 'done')
  )
  and not exists (
    select 1 from deliveries d
    where d.company_id = l.company_id
      and d.source_entity = 'sales.order'
      and d.source_id = l.order_id
      and d.state <> 'cancelled'
  );

-- 2. Invoice policy for existing stock-tracked goods: bill what was delivered.
update products
set invoice_policy = 'delivery', updated_at = now()
where kind = 'goods'
  and track_stock = true
  and invoice_policy <> 'delivery';
