import { Router } from "express";
import { getSensorConfig } from "../controllers/config-controller";

const router = Router();

router.get("/config", getSensorConfig);

export default router;