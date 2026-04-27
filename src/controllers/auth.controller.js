import { supabase, supabaseAdmin, createUserClient } from "../db/index.js";
import { asyncHandler, HttpError, requireFields } from "../utils/http.js";

const sessionResponse = (data) => ({
  user: data.user,
  session: data.session,
});

export const signUp = asyncHandler(async (req, res) => {
  requireFields(req.body, ["email", "password"]);

  const { email, password, full_name, phone } = req.body;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
        phone,
      },
    },
  });

  if (error) {
    throw new HttpError(400, "Signup failed", error.message);
  }

  if (data.user && supabaseAdmin) {
    await supabaseAdmin.from("profiles").upsert({
      id: data.user.id,
      email,
      full_name,
      phone,
    });
  }

  res.status(201).json({ data: sessionResponse(data) });
});

export const login = asyncHandler(async (req, res) => {
  requireFields(req.body, ["email", "password"]);

  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new HttpError(401, "Invalid email or password", error.message);
  }

  res.json({ data: sessionResponse(data) });
});

export const getGoogleLoginUrl = asyncHandler(async (req, res) => {
  const { redirect_to } = req.query;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirect_to,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw new HttpError(400, "Could not create Google login URL", error.message);
  }

  res.json({ data: { url: data.url } });
});

export const loginWithGoogle = getGoogleLoginUrl;

export const logout = asyncHandler(async (req, res) => {
  const client = createUserClient(req.accessToken);
  const { error } = await client.auth.signOut();

  if (error) {
    throw new HttpError(400, "Logout failed", error.message);
  }

  res.status(204).send();
});

export const refreshSession = asyncHandler(async (req, res) => {
  requireFields(req.body, ["refresh_token"]);

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: req.body.refresh_token,
  });

  if (error) {
    throw new HttpError(401, "Could not refresh session", error.message);
  }

  res.json({ data: sessionResponse(data) });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  requireFields(req.body, ["email"]);

  const { email, redirect_to } = req.body;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirect_to,
  });

  if (error) {
    throw new HttpError(400, "Could not send password reset email", error.message);
  }

  res.json({ data: { sent: true } });
});

export const sendEmailOtp = asyncHandler(async (req, res) => {
  requireFields(req.body, ["email"]);

  const { email, redirect_to, should_create_user = true } = req.body;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirect_to,
      shouldCreateUser: should_create_user,
    },
  });

  if (error) {
    throw new HttpError(400, "Could not send email OTP", error.message);
  }

  res.json({ data: { sent: true } });
});

export const verifyEmailOtp = asyncHandler(async (req, res) => {
  requireFields(req.body, ["email", "token"]);

  const { email, token, type = "email" } = req.body;
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type,
  });

  if (error) {
    throw new HttpError(400, "Email verification failed", error.message);
  }

  res.json({ data: sessionResponse(data) });
});

export const sendPhoneOtp = asyncHandler(async (req, res) => {
  requireFields(req.body, ["phone"]);

  const { phone, should_create_user = true } = req.body;
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      shouldCreateUser: should_create_user,
    },
  });

  if (error) {
    throw new HttpError(400, "Could not send phone OTP", error.message);
  }

  res.json({ data: { sent: true } });
});

export const verifyPhoneOtp = asyncHandler(async (req, res) => {
  requireFields(req.body, ["phone", "token"]);

  const { phone, token } = req.body;
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error) {
    throw new HttpError(400, "Phone verification failed", error.message);
  }

  res.json({ data: sessionResponse(data) });
});

export const updatePassword = asyncHandler(async (req, res) => {
  requireFields(req.body, ["password"]);

  const client = createUserClient(req.accessToken);
  const { data, error } = await client.auth.updateUser({
    password: req.body.password,
  });

  if (error) {
    throw new HttpError(400, "Could not update password", error.message);
  }

  res.json({ data: { user: data.user } });
});

export const getAuthUser = asyncHandler(async (req, res) => {
  res.json({ data: { user: req.user } });
});
