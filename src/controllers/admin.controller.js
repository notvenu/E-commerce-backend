import { supabaseAdmin } from "../db/index.js";
import { asyncHandler, HttpError, requireFields } from "../utils/http.js";

export const upsertShopSettings = asyncHandler(async (req, res) => {
  requireFields(req.body, ["business_name", "brand_name", "slug"]);

  const { data, error } = await supabaseAdmin
    .from("shop_settings")
    .upsert({ id: true, ...req.body }, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw new HttpError(400, "Failed to save shop settings", error.message);
  }

  res.json({ data });
});

export const createCategory = asyncHandler(async (req, res) => {
  requireFields(req.body, ["name", "slug"]);

  const { data, error } = await supabaseAdmin.from("categories").insert(req.body).select("*").single();

  if (error) {
    throw new HttpError(400, "Failed to create category", error.message);
  }

  res.status(201).json({ data });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin.from("categories").update(req.body).eq("id", id).select("*").single();

  if (error) {
    throw new HttpError(400, "Failed to update category", error.message);
  }

  res.json({ data });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from("categories").delete().eq("id", id);

  if (error) {
    throw new HttpError(400, "Failed to delete category", error.message);
  }

  res.status(204).send();
});

export const listOrders = asyncHandler(async (req, res) => {
  const { status, limit = "50", offset = "0" } = req.query;
  let query = supabaseAdmin
    .from("orders")
    .select("*, order_items (*), payments (*), shipments (*)")
    .order("created_at", { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw new HttpError(500, "Failed to fetch orders", error.message);
  }

  res.json({ data });
});

export const getOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*, order_items (*), payments (*), shipments (*)")
    .eq("id", id)
    .single();

  if (error) {
    throw new HttpError(404, "Order not found", error.message);
  }

  res.json({ data });
});

export const updateOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin.from("orders").update(req.body).eq("id", id).select("*").single();

  if (error) {
    throw new HttpError(400, "Failed to update order", error.message);
  }

  res.json({ data });
});

export const createPayment = asyncHandler(async (req, res) => {
  requireFields(req.body, ["order_id", "provider", "amount"]);

  const { data, error } = await supabaseAdmin.from("payments").insert(req.body).select("*").single();

  if (error) {
    throw new HttpError(400, "Failed to create payment", error.message);
  }

  res.status(201).json({ data });
});

export const createShipment = asyncHandler(async (req, res) => {
  requireFields(req.body, ["order_id"]);

  const { items = [], ...shipment } = req.body;
  const { data, error } = await supabaseAdmin.from("shipments").insert(shipment).select("*").single();

  if (error) {
    throw new HttpError(400, "Failed to create shipment", error.message);
  }

  if (items.length > 0) {
    const rows = items.map((item) => ({
      shipment_id: data.id,
      order_item_id: item.order_item_id,
      quantity: item.quantity,
    }));
    const { error: itemsError } = await supabaseAdmin.from("shipment_items").insert(rows);

    if (itemsError) {
      throw new HttpError(400, "Shipment created but items failed", itemsError.message);
    }
  }

  res.status(201).json({ data });
});

export const updateInventoryItem = asyncHandler(async (req, res) => {
  const {
    product_id,
    quantity = 0,
    reserved_quantity = 0,
    low_stock_threshold = 0,
  } = req.body;

  if (!product_id) {
    throw new HttpError(400, "product_id is required");
  }

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("id")
    .eq("id", product_id)
    .maybeSingle();

  if (productError) {
    throw new HttpError(400, "Failed to validate product", productError.message);
  }

  if (!product) {
    throw new HttpError(404, "Product not found");
  }

  const { data, error } = await supabaseAdmin
    .from("inventory_items")
    .upsert(
      {
        product_id,
        quantity,
        reserved_quantity,
        low_stock_threshold,
      },
      { onConflict: "product_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new HttpError(400, "Failed to update inventory", error.message);
  }

  res.json({ data });
});

export const listReviews = asyncHandler(async (req, res) => {
  const { status } = req.query;
  let query = supabaseAdmin
    .from("product_reviews")
    .select("*, products (id, title, slug), profiles (id, full_name, email)")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw new HttpError(500, "Failed to fetch reviews", error.message);
  }

  res.json({ data });
});

export const moderateReview = asyncHandler(async (req, res) => {
  requireFields(req.body, ["status"]);

  const { id } = req.params;
  const { data, error } = await supabaseAdmin
    .from("product_reviews")
    .update({ status: req.body.status })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new HttpError(400, "Failed to moderate review", error.message);
  }

  res.json({ data });
});

export const listCustomers = asyncHandler(async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, role, full_name, email, phone, avatar_url, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new HttpError(500, "Failed to fetch customers", error.message);
  }

  res.json({ data });
});

export const updateCustomerRole = asyncHandler(async (req, res) => {
  requireFields(req.body, ["role"]);

  const { id } = req.params;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ role: req.body.role })
    .eq("id", id)
    .select("id, role, full_name, email")
    .single();

  if (error) {
    throw new HttpError(400, "Failed to update customer role", error.message);
  }

  res.json({ data });
});

export const createDiscount = asyncHandler(async (req, res) => {
  requireFields(req.body, ["code", "name", "type"]);

  const { data, error } = await supabaseAdmin
    .from("discounts")
    .insert({ ...req.body, code: req.body.code.toUpperCase() })
    .select("*")
    .single();

  if (error) {
    throw new HttpError(400, "Failed to create discount", error.message);
  }

  res.status(201).json({ data });
});

export const updateDiscount = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const payload = {
    ...req.body,
    ...(req.body.code && { code: req.body.code.toUpperCase() }),
  };
  const { data, error } = await supabaseAdmin.from("discounts").update(payload).eq("id", id).select("*").single();

  if (error) {
    throw new HttpError(400, "Failed to update discount", error.message);
  }

  res.json({ data });
});

export const deleteDiscount = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from("discounts").delete().eq("id", id);

  if (error) {
    throw new HttpError(400, "Failed to delete discount", error.message);
  }

  res.status(204).send();
});

export const createTaxRate = asyncHandler(async (req, res) => {
  requireFields(req.body, ["name", "country_code", "rate"]);

  const { data, error } = await supabaseAdmin.from("tax_rates").insert(req.body).select("*").single();

  if (error) {
    throw new HttpError(400, "Failed to create tax rate", error.message);
  }

  res.status(201).json({ data });
});

export const updateTaxRate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin.from("tax_rates").update(req.body).eq("id", id).select("*").single();

  if (error) {
    throw new HttpError(400, "Failed to update tax rate", error.message);
  }

  res.json({ data });
});

export const deleteTaxRate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from("tax_rates").delete().eq("id", id);

  if (error) {
    throw new HttpError(400, "Failed to delete tax rate", error.message);
  }

  res.status(204).send();
});

export const listReturns = asyncHandler(async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("returns")
    .select("*, return_items (*), orders (id, order_number, email)")
    .order("created_at", { ascending: false });

  if (error) {
    throw new HttpError(500, "Failed to fetch returns", error.message);
  }

  res.json({ data });
});

export const updateReturn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin.from("returns").update(req.body).eq("id", id).select("*").single();

  if (error) {
    throw new HttpError(400, "Failed to update return", error.message);
  }

  res.json({ data });
});
