import { Router } from "express";
import authRoutes from "@/features/auth/auth.routes.js";
import homeRoutes from "@/features/home/home.routes.js";

const router = Router();

// Modular Routes dari Features
router.use("/", authRoutes);
router.use("/", homeRoutes);

export default router;
