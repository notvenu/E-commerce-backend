import { Router } from "express";
import { createOrder, getMyOrder, listMyOrders } from "../controllers/orders.controller.js";
import { requireAuth, requireServiceRole } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth, requireServiceRole);

router.get("/", listMyOrders);
router.post("/", createOrder);
router.get("/:id", getMyOrder);

export default router;
