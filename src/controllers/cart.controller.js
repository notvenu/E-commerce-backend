import { createUserClient, supabaseAdmin } from "../db/index.js";
import { asyncHandler, HttpError, requireFields } from "../utils/http.js";

const cartSelect = `
  id,
  user_id,
  session_id,
  status,
  currency,
  metadata,
  expires_at,
  cart_items (
    id,
    product_id,
    quantity,
    unit_price,
    metadata,
    products (
      id,
      sku,
      price,
      currency,
      title,
      slug
    )
  )
`;

const getOrCreateActiveCart = async (client, userId) => {
  const { data: existingCart, error: lookupError } = await client
    .from("carts")
    .select("id, user_id, session_id, status, currency, metadata, expires_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw new HttpError(500, "Failed to fetch cart", lookupError.message);
  }

  if (existingCart) {
    return existingCart;
  }

  const { data: createdCart, error: createError } = await client
    .from("carts")
    .insert({ user_id: userId })
    .select("id, user_id, session_id, status, currency, metadata, expires_at")
    .single();

  if (createError) {
    throw new HttpError(400, "Failed to initialize cart", createError.message);
  }

  return createdCart;
};

export const getActiveCart = asyncHandler(async (req, res) => {
  const client = createUserClient(req.accessToken);
  const { data, error } = await client
    .from("carts")
    .select(cartSelect)
    .eq("user_id", req.user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Failed to fetch cart", error.message);
  }

  res.json({ data });
});

export const addCartItem = asyncHandler(async (req, res) => {
  requireFields(req.body, ["product_id", "quantity"]);

  const client = createUserClient(req.accessToken);
  const { cart_id: cartIdInput, product_id, quantity, unit_price, metadata = {} } = req.body;
  const parsedQuantity = Number(quantity);

  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
    throw new HttpError(400, "Quantity must be greater than 0");
  }

  const productClient = supabaseAdmin || client;
  const { data: product, error: productError } = await productClient
    .from("products")
    .select("id, title, slug, status, price, currency, sku")
    .eq("id", product_id)
    .maybeSingle();

  if (productError) {
    throw new HttpError(400, "Failed to fetch product", productError.message);
  }

  if (!product) {
    throw new HttpError(404, "Product not found");
  }

  if (product.status !== "active") {
    throw new HttpError(400, "Only active products can be added to cart");
  }

  const { data: inventory, error: inventoryError } = await productClient
    .from("inventory_items")
    .select("id, quantity, reserved_quantity")
    .eq("product_id", product_id)
    .maybeSingle();

  if (inventoryError) {
    throw new HttpError(400, "Failed to fetch inventory", inventoryError.message);
  }

  if (!inventory) {
    throw new HttpError(400, "Product is out of stock");
  }

  const availableQuantity = Number(inventory.quantity) - Number(inventory.reserved_quantity || 0);

  if (availableQuantity < parsedQuantity) {
    throw new HttpError(400, `Insufficient stock. Available: ${Math.max(availableQuantity, 0)}`);
  }

  const cart = cartIdInput ? { id: cartIdInput } : await getOrCreateActiveCart(client, req.user.id);

  const { data, error } = await client
    .from("cart_items")
    .upsert(
      {
        cart_id: cart.id,
        product_id,
        quantity: parsedQuantity,
        unit_price: unit_price ?? product.price,
        metadata,
      },
      { onConflict: "cart_id,product_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new HttpError(400, "Failed to add cart item", error.message);
  }

  res.status(201).json({ data });
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const client = createUserClient(req.accessToken);
  const { id } = req.params;
  const { quantity } = req.body;

  if (quantity <= 0) {
    throw new HttpError(400, "Quantity must be greater than 0");
  }

  const { data, error } = await client.from("cart_items").update({ quantity }).eq("id", id).select("*").single();

  if (error) {
    throw new HttpError(400, "Failed to update cart item", error.message);
  }

  res.json({ data });
});

export const removeCartItem = asyncHandler(async (req, res) => {
  const client = createUserClient(req.accessToken);
  const { id } = req.params;
  const { error } = await client.from("cart_items").delete().eq("id", id);

  if (error) {
    throw new HttpError(400, "Failed to remove cart item", error.message);
  }

  res.status(204).send();
});
