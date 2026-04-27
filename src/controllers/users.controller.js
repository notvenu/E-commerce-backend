import { createUserClient } from "../db/index.js";
import { asyncHandler, HttpError, requireFields } from "../utils/http.js";

export const getMe = asyncHandler(async (req, res) => {
  const client = createUserClient(req.accessToken);
  const { data, error } = await client
    .from("profiles")
    .select("id, role, full_name, email, phone, avatar_url, preferences, metadata, created_at, updated_at")
    .eq("id", req.user.id)
    .single();

  if (error) {
    throw new HttpError(404, "Profile not found", error.message);
  }

  res.json({ data });
});

export const updateMe = asyncHandler(async (req, res) => {
  const client = createUserClient(req.accessToken);
  const { full_name, phone, avatar_url, preferences, metadata } = req.body;
  const payload = {
    ...(full_name !== undefined && { full_name }),
    ...(phone !== undefined && { phone }),
    ...(avatar_url !== undefined && { avatar_url }),
    ...(preferences !== undefined && { preferences }),
    ...(metadata !== undefined && { metadata }),
  };

  const { data, error } = await client
    .from("profiles")
    .update(payload)
    .eq("id", req.user.id)
    .select("id, role, full_name, email, phone, avatar_url, preferences, metadata, created_at, updated_at")
    .single();

  if (error) {
    throw new HttpError(400, "Failed to update profile", error.message);
  }

  res.json({ data });
});

export const listMyAddresses = asyncHandler(async (req, res) => {
  const client = createUserClient(req.accessToken);
  const { data, error } = await client
    .from("addresses")
    .select("*")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new HttpError(500, "Failed to fetch addresses", error.message);
  }

  res.json({ data });
});

export const createAddress = asyncHandler(async (req, res) => {
  requireFields(req.body, ["full_name", "line1", "city", "postal_code", "country_code"]);

  const client = createUserClient(req.accessToken);
  const { data, error } = await client
    .from("addresses")
    .insert({
      ...req.body,
      user_id: req.user.id,
    })
    .select("*")
    .single();

  if (error) {
    throw new HttpError(400, "Failed to create address", error.message);
  }

  res.status(201).json({ data });
});

export const updateAddress = asyncHandler(async (req, res) => {
  const client = createUserClient(req.accessToken);
  const { id } = req.params;
  const { data, error } = await client
    .from("addresses")
    .update(req.body)
    .eq("id", id)
    .eq("user_id", req.user.id)
    .select("*")
    .single();

  if (error) {
    throw new HttpError(400, "Failed to update address", error.message);
  }

  res.json({ data });
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const client = createUserClient(req.accessToken);
  const { id } = req.params;
  const { error } = await client.from("addresses").delete().eq("id", id).eq("user_id", req.user.id);

  if (error) {
    throw new HttpError(400, "Failed to delete address", error.message);
  }

  res.status(204).send();
});
