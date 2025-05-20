import express from "express";
import {
  generateManimVideo,
  getManimProject,
  getVideo,
} from "../controllers/manimController";
import { updateManimCode } from "../controllers/updatedManimController";
import { getAllManimProjects } from "../controllers/getAllManimProjects";

const router = express.Router();

router.post("/generate", (req, res) => generateManimVideo(req, res));
router.get("/project/:projectId", getManimProject);

router.get("/video/:videoId", getVideo);

// Updated the Code and Generate the video

// Get all projects with pagination
router.get("/projects", getAllManimProjects);

router.put("/update/project/:projectId", (req, res) =>
  updateManimCode(req, res)
);

export default router;
