import { Router } from "express";
import shopRoutes from "./shop.routes.js";
import categoryRoutes from "./categories.routes.js";
import productRoutes from "./products.routes.js";
import cartRoutes from "./cart.routes.js";
import orderRoutes from "./orders.routes.js";
import adminRoutes from "./admin.routes.js";
import userRoutes from "./users.routes.js";
import authRoutes from "./auth.routes.js";
import wishlistRoutes from "./wishlists.routes.js";
import reviewRoutes from "./reviews.routes.js";
import discountRoutes from "./discounts.routes.js";
import returnRoutes from "./returns.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

router.use("/shop", shopRoutes);
router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/users", userRoutes);
router.use("/cart", cartRoutes);
router.use("/orders", orderRoutes);
router.use("/wishlists", wishlistRoutes);
router.use("/reviews", reviewRoutes);
router.use("/discounts", discountRoutes);
router.use("/returns", returnRoutes);
router.use("/admin", adminRoutes);

export default router;
