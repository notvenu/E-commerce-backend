import { supabase } from "../db/index.js";
import { asyncHandler, HttpError } from "../utils/http.js";

export const listCategories = asyncHandler(async (_req, res) => {
  const { data, error } = await supabase
    .from("categories")
    .select("id, parent_id, name, slug, description, image_url, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new HttpError(500, "Failed to fetch categories", error.message);
  }

  res.json({ data });
});
