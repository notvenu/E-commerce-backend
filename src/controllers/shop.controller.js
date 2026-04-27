import { supabase } from "../db/index.js";
import { asyncHandler, HttpError } from "../utils/http.js";

export const getShopSettings = asyncHandler(async (_req, res) => {
  const { data, error } = await supabase.from("shop_settings").select("*").eq("is_active", true).maybeSingle();

  if (error) {
    throw new HttpError(500, "Failed to fetch shop settings", error.message);
  }

  res.json({ data });
});
