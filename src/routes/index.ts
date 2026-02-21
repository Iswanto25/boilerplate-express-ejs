import { Router } from "express";
import { indexController } from "../features/home/controllers/indexController";
import { authenticate } from "../middlewares/authMiddleware";
import authRoutes from "./authRoutes";

const router = Router();

// Modular Auth Routes
router.use("/", authRoutes);

// Protected Home Route
router.get("/", authenticate.verifyToken, indexController.home);

export default router;
