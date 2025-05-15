import express from "express";
import { generateManimVideo } from "../controllers/manimController";

const router = express.Router();

router.post("/generate", (req, res) => generateManimVideo(req, res));

export default router;
