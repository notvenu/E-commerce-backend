import { supabaseAdmin } from "../db/index.js";
import { asyncHandler, HttpError, requireFields } from "../utils/http.js";

const orderSelect = `
  *,
  order_items (*),
  payments (*),
  shipments (*)
`;

const restoreInventory = async (adjustments) => {
  for (const adjustment of adjustments) {
    const { data: currentInventory, error: lookupError } = await supabaseAdmin
      .from("inventory_items")
      .select("id, quantity")
      .eq("id", adjustment.inventory_id)
      .maybeSingle();

    if (lookupError || !currentInventory) {
      continue;
    }

    await supabaseAdmin
      .from("inventory_items")
      .update({ quantity: Number(currentInventory.quantity) + Number(adjustment.quantity) })
      .eq("id", adjustment.inventory_id);
  }
};

export const createOrder = asyncHandler(async (req, res) => {
  requireFields(req.body, ["email", "billing_address", "shipping_address", "items"]);

  const {
    items,
    email,
    phone,
    currency = "USD",
    billing_address,
    shipping_address,
    discount_amount = 0,
    shipping_amount = 0,
    tax_amount = 0,
    notes,
    metadata = {},
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, "Order must include at least one item");
  }

  const requiredQuantityByProduct = new Map();
  for (const item of items) {
    requireFields(item, ["product_id", "quantity"]);
    const parsedQuantity = Number(item.quantity);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      throw new HttpError(400, "Each order item quantity must be greater than 0");
    }

    requiredQuantityByProduct.set(
      item.product_id,
      Number(requiredQuantityByProduct.get(item.product_id) || 0) + parsedQuantity,
    );
  }

  const productPurchaseDataEntries = await Promise.all(
    [...requiredQuantityByProduct.entries()].map(async ([productId, requestedQuantity]) => {
      const { data: product, error: productError } = await supabaseAdmin
        .from("products")
        .select("id, title, status, sku, price")
        .eq("id", productId)
        .maybeSingle();

      if (productError) {
        throw new HttpError(400, "Failed to fetch product", productError.message);
      }

      if (!product) {
        throw new HttpError(404, `Product not found: ${productId}`);
      }

      if (product.status !== "active") {
        throw new HttpError(400, `Product is not available: ${product.title}`);
      }

      const { data: inventory, error: inventoryError } = await supabaseAdmin
        .from("inventory_items")
        .select("id, quantity, reserved_quantity")
        .eq("product_id", productId)
        .maybeSingle();

      if (inventoryError) {
        throw new HttpError(400, "Failed to fetch inventory", inventoryError.message);
      }

      if (!inventory) {
        throw new HttpError(400, `Product is out of stock: ${product.title}`);
      }

      const availableQuantity = Number(inventory.quantity) - Number(inventory.reserved_quantity || 0);
      if (availableQuantity < Number(requestedQuantity)) {
        throw new HttpError(
          400,
          `Insufficient stock for ${product.title}. Available: ${Math.max(availableQuantity, 0)}`,
        );
      }

      return [productId, { product, inventory, requestedQuantity: Number(requestedQuantity) }];
    }),
  );

  const productPurchaseData = new Map(productPurchaseDataEntries);

  const preparedItems = await Promise.all(
    items.map(async (item) => {
      const purchaseData = productPurchaseData.get(item.product_id);
      const unitPrice = item.unit_price ?? purchaseData.product.price;
      const lineTotal =
        Number(unitPrice) * Number(item.quantity) -
        Number(item.discount_amount || 0) +
        Number(item.tax_amount || 0);

      return {
        order_id: null,
        product_id: purchaseData.product.id,
        product_title: item.product_title || purchaseData.product.title,
        sku: purchaseData.product.sku,
        quantity: item.quantity,
        unit_price: unitPrice,
        discount_amount: item.discount_amount || 0,
        tax_amount: item.tax_amount || 0,
        total_amount: lineTotal,
        metadata: item.metadata || {},
      };
    }),
  );

  const subtotal = preparedItems.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);
  const total = subtotal - Number(discount_amount) + Number(shipping_amount) + Number(tax_amount);

  const inventoryAdjustments = [];
  for (const purchaseData of productPurchaseData.values()) {
    const targetQuantity = Number(purchaseData.inventory.quantity) - Number(purchaseData.requestedQuantity);
    const { data: updatedInventory, error: inventoryUpdateError } = await supabaseAdmin
      .from("inventory_items")
      .update({ quantity: targetQuantity })
      .eq("id", purchaseData.inventory.id)
      .eq("quantity", purchaseData.inventory.quantity)
      .select("id")
      .maybeSingle();

    if (inventoryUpdateError) {
      await restoreInventory(inventoryAdjustments);
      throw new HttpError(400, "Failed to reserve inventory", inventoryUpdateError.message);
    }

    if (!updatedInventory) {
      await restoreInventory(inventoryAdjustments);
      throw new HttpError(409, "Inventory changed during checkout. Please retry your order.");
    }

    inventoryAdjustments.push({
      inventory_id: purchaseData.inventory.id,
      quantity: purchaseData.requestedQuantity,
    });
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert({
      customer_id: req.user.id,
      email,
      phone,
      currency,
      billing_address,
      shipping_address,
      subtotal_amount: subtotal,
      discount_amount,
      shipping_amount,
      tax_amount,
      total_amount: total,
      notes,
      metadata,
    })
    .select("*")
    .single();

  if (orderError) {
    await restoreInventory(inventoryAdjustments);
    throw new HttpError(400, "Failed to create order", orderError.message);
  }

  const orderItems = preparedItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

  const { error: itemsError } = await supabaseAdmin.from("order_items").insert(orderItems);

  if (itemsError) {
    await restoreInventory(inventoryAdjustments);
    throw new HttpError(400, "Failed to create order items", itemsError.message);
  }

  const { data, error } = await supabaseAdmin.from("orders").select(orderSelect).eq("id", order.id).single();

  if (error) {
    await restoreInventory(inventoryAdjustments);
    throw new HttpError(500, "Order created but failed to reload", error.message);
  }

  res.status(201).json({ data });
});

export const listMyOrders = asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(orderSelect)
    .eq("customer_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new HttpError(500, "Failed to fetch orders", error.message);
  }

  res.json({ data });
});

export const getMyOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(orderSelect)
    .eq("id", id)
    .eq("customer_id", req.user.id)
    .single();

  if (error) {
    throw new HttpError(404, "Order not found", error.message);
  }

  res.json({ data });
});
