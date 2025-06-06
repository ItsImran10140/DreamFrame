import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { processManimRequest } from "./processManimRequest";

const jobStatus: any = {};
export const generateManimVideo = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Prompt is Required" });
      return;
    }

    // Get user from authenticated request
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "User authentication required" });
      return;
    }

    const jobId = uuidv4();

    jobStatus[jobId] = {
      status: "Processing",
      progress: "Generating Manim Code",
    };

    // Set up response headers for streaming
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Pass userId to processManimRequest
    processManimRequest(jobId, prompt, res, userId);
  } catch (error) {
    console.error("Error in generateManimVideo:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
