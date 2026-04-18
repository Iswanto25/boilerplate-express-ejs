import { Router } from "express";
import { homeController } from "@/features/home/controllers/home.controller.js";
import { authenticate } from "@/middlewares/auth.middleware.js";

const router = Router();

router.get("/", authenticate.verifyToken, homeController.home);

export default router;
