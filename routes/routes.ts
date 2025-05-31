import express from "express";
import { updateManimCode } from "../controllers/updatedManimController";
import { getAllManimProjects } from "../controllers/getAllManimProjects";
import { generateManimVideo } from "../controllers/generateManimVideo";
import { getManimProject } from "../controllers/getManimProject";
import { getVideo } from "../controllers/getVideo";
import { register } from "../controllers/user/createUser";
import { login } from "../controllers/user/login";
import { authenticateToken } from "../middlewares/authMidleWare";
import { getProfile } from "../controllers/user/getProfile";
import { updateProfile } from "../controllers/user/updateProfile";
import { updatePassword } from "../controllers/user/updatePassword";
import { logout } from "../controllers/user/logout";
import { deleteAccount } from "../controllers/user/deleteAccount";

const router = express.Router();

// Manim routes
router.post("/generate", authenticateToken, (req, res) =>
  generateManimVideo(req, res)
);
router.get("/project/:projectId", authenticateToken, getManimProject);
router.get("/video/:videoId", authenticateToken, getVideo);
router.get("/projects", authenticateToken, getAllManimProjects);
router.put("/update/project/:projectId", authenticateToken, (req, res) =>
  updateManimCode(req, res)
);

// User
router.post("/register", register);
router.post("/login", login);

// Protected routes (require authentication)
router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);
router.put("/password", authenticateToken, updatePassword);
router.post("/logout", authenticateToken, logout);
router.delete("/account", authenticateToken, deleteAccount);

export default router;
