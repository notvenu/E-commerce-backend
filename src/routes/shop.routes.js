import { Router } from "express";
import { getShopSettings } from "../controllers/shop.controller.js";

const router = Router();

router.get("/", getShopSettings);

export default router;
