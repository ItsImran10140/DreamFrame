import express from "express";
import { updateManimCode } from "../controllers/updatedManimController";
import { getAllManimProjects } from "../controllers/getAllManimProjects";
import { generateManimVideo } from "../controllers/generateManimVideo";
import { getManimProject } from "../controllers/getManimProject";
import { getVideo } from "../controllers/getVideo";

const router = express.Router();

router.post("/generate", (req, res) => generateManimVideo(req, res));
router.get("/project/:projectId", getManimProject);
router.get("/video/:videoId", getVideo);
router.get("/projects", getAllManimProjects);
router.put("/update/project/:projectId", (req, res) =>
  updateManimCode(req, res)
);

export default router;
