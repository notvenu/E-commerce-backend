import { Router } from "express";
import { createReview, listProductReviews } from "../controllers/reviews.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/products/:productId", listProductReviews);
router.post("/", requireAuth, createReview);

export default router;
