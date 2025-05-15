import express from "express";
import {
  generateManimVideo,
  getManimProject,
  getVideo,
} from "../controllers/manimController";

const router = express.Router();

router.post("/generate", (req, res) => generateManimVideo(req, res));

router.get("/project/:projectId", getManimProject);

router.get("/video/:videoId", getVideo);

export default router;
