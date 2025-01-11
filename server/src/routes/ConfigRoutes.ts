import { Router } from "express";
import { getSensorConfig } from "../controllers/ConfigController";

const router = Router();

router.get("/config", getSensorConfig);

export default router;