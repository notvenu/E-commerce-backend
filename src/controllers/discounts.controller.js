import { supabase } from "../db/index.js";
import { asyncHandler, HttpError } from "../utils/http.js";

export const listActiveDiscounts = asyncHandler(async (_req, res) => {
  const { data, error } = await supabase
    .from("discounts")
    .select("id, code, name, type, value, minimum_subtotal, starts_at, ends_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw new HttpError(500, "Failed to fetch discounts", error.message);
  }

  res.json({ data });
});

export const getDiscountByCode = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const { data, error } = await supabase
    .from("discounts")
    .select("id, code, name, type, value, minimum_subtotal, starts_at, ends_at")
    .eq("code", code.toUpperCase())
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Failed to fetch discount", error.message);
  }

  if (!data) {
    throw new HttpError(404, "Discount not found");
  }

  res.json({ data });
});
