import { Router } from "express";
import {
  addCartItem,
  getActiveCart,
  removeCartItem,
  updateCartItem,
} from "../controllers/cart.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getActiveCart);
router.post("/items", addCartItem);
router.patch("/items/:id", updateCartItem);
router.delete("/items/:id", removeCartItem);

export default router;
