import express from "express";
import {
  generateManimVideo,
  getManimProject,
  getVideo,
} from "../controllers/manimController";
import { updateManimCode } from "../controllers/updatedManimController";

const router = express.Router();

router.post("/generate", (req, res) => generateManimVideo(req, res));
router.get("/project/:projectId", getManimProject);
router.get("/video/:videoId", getVideo);

// Updated the Code and Generate the video

router.put("/update/project/:projectId", (req, res) =>
  updateManimCode(req, res)
);

export default router;
