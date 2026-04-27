import { Router } from "express";
import {
  createCategory,
  createDiscount,
  createPayment,
  createShipment,
  createTaxRate,
  deleteCategory,
  deleteDiscount,
  deleteTaxRate,
  getOrder,
  listCustomers,
  listOrders,
  listReviews,
  listReturns,
  moderateReview,
  updateCategory,
  updateCustomerRole,
  updateDiscount,
  updateInventoryItem,
  updateOrder,
  updateReturn,
  updateTaxRate,
  upsertShopSettings,
} from "../controllers/admin.controller.js";
import {
  createProduct,
  createProductMedia,
  deleteProduct,
  deleteProductMedia,
  setProductCategories,
  updateProduct,
  updateProductMedia,
} from "../controllers/products.controller.js";
import { requireAdmin, requireAuth, requireServiceRole } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth, requireAdmin, requireServiceRole);

router.put("/shop", upsertShopSettings);
router.post("/categories", createCategory);
router.patch("/categories/:id", updateCategory);
router.delete("/categories/:id", deleteCategory);
router.post("/products", createProduct);
router.patch("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);
router.put("/products/:id/categories", setProductCategories);
router.post("/product-media", createProductMedia);
router.patch("/product-media/:id", updateProductMedia);
router.delete("/product-media/:id", deleteProductMedia);
router.get("/orders", listOrders);
router.get("/orders/:id", getOrder);
router.patch("/orders/:id", updateOrder);
router.post("/payments", createPayment);
router.post("/shipments", createShipment);
router.put("/inventory", updateInventoryItem);
router.post("/discounts", createDiscount);
router.patch("/discounts/:id", updateDiscount);
router.delete("/discounts/:id", deleteDiscount);
router.post("/tax-rates", createTaxRate);
router.patch("/tax-rates/:id", updateTaxRate);
router.delete("/tax-rates/:id", deleteTaxRate);
router.get("/reviews", listReviews);
router.patch("/reviews/:id", moderateReview);
router.get("/returns", listReturns);
router.patch("/returns/:id", updateReturn);
router.get("/customers", listCustomers);
router.patch("/customers/:id/role", updateCustomerRole);

export default router;
