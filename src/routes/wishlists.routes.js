import { Router } from "express";
import {
  addWishlistItem,
  listWishlists,
  removeWishlistItem,
} from "../controllers/wishlists.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", listWishlists);
router.post("/items", addWishlistItem);
router.delete("/:wishlistId/items/:productId", removeWishlistItem);

export default router;
