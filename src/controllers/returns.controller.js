import { createUserClient, supabaseAdmin } from "../db/index.js";
import { asyncHandler, HttpError, requireFields } from "../utils/http.js";

export const createReturnRequest = asyncHandler(async (req, res) => {
  requireFields(req.body, ["order_id", "items"]);

  const { order_id, items, reason, metadata = {} } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, "Return request must include at least one item");
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, customer_id")
    .eq("id", order_id)
    .eq("customer_id", req.user.id)
    .single();

  if (orderError || !order) {
    throw new HttpError(404, "Order not found");
  }

  const { data: returnRequest, error } = await supabaseAdmin
    .from("returns")
    .insert({
      order_id,
      customer_id: req.user.id,
      reason,
      metadata,
    })
    .select("*")
    .single();

  if (error) {
    throw new HttpError(400, "Failed to create return request", error.message);
  }

  const rows = items.map((item) => ({
    return_id: returnRequest.id,
    order_item_id: item.order_item_id,
    quantity: item.quantity,
    condition: item.condition,
  }));

  const { error: itemsError } = await supabaseAdmin.from("return_items").insert(rows);

  if (itemsError) {
    throw new HttpError(400, "Return created but items failed", itemsError.message);
  }

  res.status(201).json({ data: returnRequest });
});

export const listMyReturns = asyncHandler(async (req, res) => {
  const client = createUserClient(req.accessToken);
  const { data, error } = await client
    .from("returns")
    .select("*, return_items (*)")
    .eq("customer_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new HttpError(500, "Failed to fetch returns", error.message);
  }

  res.json({ data });
});
