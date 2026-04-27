import { Router } from "express";
import { createReturnRequest, listMyReturns } from "../controllers/returns.controller.js";
import { requireAuth, requireServiceRole } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth, requireServiceRole);

router.get("/", listMyReturns);
router.post("/", createReturnRequest);

export default router;
