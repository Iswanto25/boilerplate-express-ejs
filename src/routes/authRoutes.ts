import { Router } from "express";
import { authController } from "../features/auth/controllers/authController";

const router = Router();

router.get("/login", authController.renderLogin);
router.get("/register", authController.renderRegister);
router.post("/login", authController.login);
router.post("/register", authController.register);
router.get("/logout", authController.logout);

export default router;
