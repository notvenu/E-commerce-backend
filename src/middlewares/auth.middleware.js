import { supabase, supabaseAdmin } from "../db/index.js";
import { HttpError } from "../utils/http.js";

const getBearerToken = (req) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length);
};

export const requireAuth = async (req, _res, next) => {
  try {
    const token = getBearerToken(req);

    if (!token) {
      throw new HttpError(401, "Missing bearer token");
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new HttpError(401, "Invalid or expired token");
    }

    req.accessToken = token;
    req.user = data.user;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin = async (req, _res, next) => {
  try {
    if (!req.user) {
      throw new HttpError(401, "Authentication required");
    }

    const client = supabaseAdmin || supabase;
    const { data: profile, error } = await client
      .from("profiles")
      .select("id, role")
      .eq("id", req.user.id)
      .single();

    if (error) {
      throw new HttpError(403, "Could not verify user role", error.message);
    }

    if (!["admin", "staff"].includes(profile.role)) {
      throw new HttpError(403, "Admin or staff access required");
    }

    req.profile = profile;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireServiceRole = (_req, _res, next) => {
  if (!supabaseAdmin) {
    next(new HttpError(500, "Missing SUPABASE_SERVICE_ROLE_KEY. Server-side writes need a service role key."));
    return;
  }

  next();
};
