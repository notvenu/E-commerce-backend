import { supabase, supabaseAdmin } from "../db/index.js";
import { asyncHandler, HttpError, requireFields } from "../utils/http.js";

const productSelect = `
  id,
  title,
  slug,
  subtitle,
  description,
  status,
  is_featured,
  sku,
  price,
  compare_at_price,
  cost,
  currency,
  attributes,
  seo,
  published_at,
  product_media (
    id,
    url,
    alt_text,
    media_type,
    sort_order
  ),
  product_categories (
    categories (
      id,
      name,
      slug
    )
  )
`;

const normalizeProduct = (product) => {
  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    subtitle: product.subtitle,
    description: product.description,
    status: product.status,
    is_featured: product.is_featured,
    sku: product.sku,
    price: product.price,
    compare_at_price: product.compare_at_price,
    cost: product.cost,
    currency: product.currency,
    attributes: product.attributes,
    seo: product.seo,
    published_at: product.published_at,
    media: product.product_media || [],
    categories:
      product.product_categories
        ?.map((entry) => entry.categories)
        .filter(Boolean) || [],
  };
};

export const listProducts = asyncHandler(async (req, res) => {
  const { category, featured, q, limit = "20", offset = "0" } = req.query;
  let query = supabase
    .from("products")
    .select(productSelect)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (featured === "true") {
    query = query.eq("is_featured", true);
  }

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new HttpError(500, "Failed to fetch products", error.message);
  }

  const filtered = category
    ? data.filter((product) =>
        product.product_categories?.some((entry) => entry.categories?.slug === category),
      )
    : data;

  res.json({ data: filtered.map(normalizeProduct) });
});

export const getProductBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { data, error } = await supabase
    .from("products")
    .select(productSelect)
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (error) {
    throw new HttpError(404, "Product not found", error.message);
  }

  res.json({ data: normalizeProduct(data) });
});

export const createProduct = asyncHandler(async (req, res) => {
  requireFields(req.body, ["title", "slug", "price"]);

  const client = supabaseAdmin;
  const {
    media = [],
    category_ids = [],
    ...productPayload
  } = req.body;
  const price = Number(productPayload.price);

  if (!Number.isFinite(price) || price < 0) {
    throw new HttpError(400, "price must be a non-negative number");
  }

  productPayload.price = price;
  const categoryIds = category_ids.filter(Boolean);
  const { data: product, error: productError } = await client
    .from("products")
    .insert(productPayload)
    .select("*")
    .single();

  if (productError) {
    throw new HttpError(400, "Failed to create product", productError.message);
  }

  if (categoryIds.length > 0) {
    const rows = categoryIds.map((categoryId) => ({
      product_id: product.id,
      category_id: categoryId,
    }));
    const { error } = await client.from("product_categories").insert(rows);
    if (error) throw new HttpError(400, "Failed to attach categories", error.message);
  }

  if (media.length > 0) {
    const rows = media.map((item) => ({ ...item, product_id: product.id }));
    const { error } = await client.from("product_media").insert(rows);
    if (error) throw new HttpError(400, "Failed to create product media", error.message);
  }

  res.status(201).json({ data: product });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { category_ids, media, ...payload } = req.body;
  const { data, error } = await supabaseAdmin.from("products").update(payload).eq("id", id).select("*").single();

  if (error) {
    throw new HttpError(400, "Failed to update product", error.message);
  }

  res.json({ data });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from("products").delete().eq("id", id);

  if (error) {
    throw new HttpError(400, "Failed to delete product", error.message);
  }

  res.status(204).send();
});

export const createProductMedia = asyncHandler(async (req, res) => {
  requireFields(req.body, ["product_id", "url"]);

  const { data, error } = await supabaseAdmin.from("product_media").insert(req.body).select("*").single();

  if (error) {
    throw new HttpError(400, "Failed to create product media", error.message);
  }

  res.status(201).json({ data });
});

export const updateProductMedia = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin.from("product_media").update(req.body).eq("id", id).select("*").single();

  if (error) {
    throw new HttpError(400, "Failed to update product media", error.message);
  }

  res.json({ data });
});

export const deleteProductMedia = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from("product_media").delete().eq("id", id);

  if (error) {
    throw new HttpError(400, "Failed to delete product media", error.message);
  }

  res.status(204).send();
});

export const setProductCategories = asyncHandler(async (req, res) => {
  requireFields(req.body, ["category_ids"]);

  const { id } = req.params;
  const categoryIdsInput = req.body.category_ids;

  if (!Array.isArray(categoryIdsInput)) {
    throw new HttpError(400, "category_ids must be an array");
  }

  const categoryIds = categoryIdsInput.filter(Boolean);

  const { error: deleteError } = await supabaseAdmin.from("product_categories").delete().eq("product_id", id);

  if (deleteError) {
    throw new HttpError(400, "Failed to clear product categories", deleteError.message);
  }

  if (categoryIds.length > 0) {
    const rows = categoryIds.map((categoryId) => ({
      product_id: id,
      category_id: categoryId,
    }));
    const { error: insertError } = await supabaseAdmin.from("product_categories").insert(rows);

    if (insertError) {
      throw new HttpError(400, "Failed to set product categories", insertError.message);
    }
  }

  res.json({ data: { product_id: id, category_ids: categoryIds } });
});
