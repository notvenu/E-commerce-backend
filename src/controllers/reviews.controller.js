import { createUserClient, supabase } from "../db/index.js";
import { asyncHandler, HttpError, requireFields } from "../utils/http.js";

export const listProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { data, error } = await supabase
    .from("product_reviews")
    .select("id, product_id, rating, title, body, created_at")
    .eq("product_id", productId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    throw new HttpError(500, "Failed to fetch reviews", error.message);
  }

  res.json({ data });
});

export const createReview = asyncHandler(async (req, res) => {
  requireFields(req.body, ["product_id", "rating"]);

  const client = createUserClient(req.accessToken);
  const { data, error } = await client
    .from("product_reviews")
    .insert({
      ...req.body,
      user_id: req.user.id,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    throw new HttpError(400, "Failed to create review", error.message);
  }

  res.status(201).json({ data });
});
