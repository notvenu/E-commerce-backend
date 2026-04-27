import { createUserClient } from "../db/index.js";
import { asyncHandler, HttpError, requireFields } from "../utils/http.js";

const wishlistSelect = `
  *,
  wishlist_items (
    product_id,
    created_at,
    products (
      id,
      title,
      slug,
      subtitle,
      product_media (
        url,
        alt_text,
        sort_order
      )
    )
  )
`;

const getOrCreateDefaultWishlist = async (client, userId) => {
  const { data: existingWishlist, error: lookupError } = await client
    .from("wishlists")
    .select("id, user_id, name, is_default, created_at, updated_at")
    .eq("user_id", userId)
    .eq("is_default", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw new HttpError(500, "Failed to fetch wishlist", lookupError.message);
  }

  if (existingWishlist) {
    return existingWishlist;
  }

  const { data: createdWishlist, error: createError } = await client
    .from("wishlists")
    .insert({ user_id: userId, name: "Wishlist", is_default: true })
    .select("id, user_id, name, is_default, created_at, updated_at")
    .single();

  if (createError) {
    throw new HttpError(400, "Failed to initialize wishlist", createError.message);
  }

  return createdWishlist;
};

export const listWishlists = asyncHandler(async (req, res) => {
  const client = createUserClient(req.accessToken);
  await getOrCreateDefaultWishlist(client, req.user.id);
  const { data, error } = await client.from("wishlists").select(wishlistSelect).eq("user_id", req.user.id);

  if (error) {
    throw new HttpError(500, "Failed to fetch wishlists", error.message);
  }

  res.json({ data });
});

export const addWishlistItem = asyncHandler(async (req, res) => {
  requireFields(req.body, ["product_id"]);

  const client = createUserClient(req.accessToken);
  const { wishlist_id: wishlistIdInput, product_id } = req.body;
  const wishlist = wishlistIdInput ? { id: wishlistIdInput } : await getOrCreateDefaultWishlist(client, req.user.id);
  const { data, error } = await client
    .from("wishlist_items")
    .insert({ wishlist_id: wishlist.id, product_id })
    .select("*")
    .single();

  if (error) {
    throw new HttpError(400, "Failed to add wishlist item", error.message);
  }

  res.status(201).json({ data });
});

export const removeWishlistItem = asyncHandler(async (req, res) => {
  const client = createUserClient(req.accessToken);
  const { wishlistId, productId } = req.params;
  const { error } = await client
    .from("wishlist_items")
    .delete()
    .eq("wishlist_id", wishlistId)
    .eq("product_id", productId);

  if (error) {
    throw new HttpError(400, "Failed to remove wishlist item", error.message);
  }

  res.status(204).send();
});
