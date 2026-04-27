import { Router } from "express";
import { getDiscountByCode, listActiveDiscounts } from "../controllers/discounts.controller.js";

const router = Router();

router.get("/", listActiveDiscounts);
router.get("/:code", getDiscountByCode);

export default router;
