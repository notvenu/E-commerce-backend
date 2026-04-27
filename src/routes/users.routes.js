import { Router } from "express";
import {
  createAddress,
  deleteAddress,
  getMe,
  listMyAddresses,
  updateAddress,
  updateMe,
} from "../controllers/users.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/me", getMe);
router.patch("/me", updateMe);
router.get("/me/addresses", listMyAddresses);
router.post("/me/addresses", createAddress);
router.patch("/me/addresses/:id", updateAddress);
router.delete("/me/addresses/:id", deleteAddress);

export default router;
