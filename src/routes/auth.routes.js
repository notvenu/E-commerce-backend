import { Router } from "express";
import {
  forgotPassword,
  getAuthUser,
  getGoogleLoginUrl,
  login,
  logout,
  refreshSession,
  sendEmailOtp,
  sendPhoneOtp,
  signUp,
  updatePassword,
  verifyEmailOtp,
  verifyPhoneOtp,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/signup", signUp);
router.post("/login", login);
router.get("/google", getGoogleLoginUrl);
router.post("/refresh", refreshSession);
router.post("/forgot-password", forgotPassword);
router.post("/otp/email", sendEmailOtp);
router.post("/otp/email/verify", verifyEmailOtp);
router.post("/otp/phone", sendPhoneOtp);
router.post("/otp/phone/verify", verifyPhoneOtp);
router.get("/me", requireAuth, getAuthUser);
router.post("/logout", requireAuth, logout);
router.patch("/password", requireAuth, updatePassword);

export default router;
