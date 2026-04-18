import { z } from "zod";
import { authValidation } from "@/features/auth/validations/auth.validation.js";

export type RegisterInput = z.infer<typeof authValidation.register>;
export type LoginInput = z.infer<typeof authValidation.login>;
