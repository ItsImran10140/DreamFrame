import path from "path";
import llmCodeGenService from "../services/llmCodeGenService";
import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

const jobStatus: any = {};
export const generateManimVideo = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Prompt i Required" });
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

    processManimRequest(jobId, prompt, res);
  } catch (error) {
    console.error("Error in generateManimVideo:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

async function processManimRequest(
  jobId: string,
  prompt: string,
  res: Response
) {
  try {
    // Step 1: Generate Manim code using Gemini
    jobStatus[jobId].progress = "Generating Manim code with Gemini";
    res.write("Generating Manim code with Gemini AI...\n");
    let manimCode;
    try {
      manimCode = await llmCodeGenService.generateManimCode(prompt);
    } catch (geminiError) {
      console.error("Gemini API error:", geminiError);
      res.write("Gemini API error occurred. Using fallback code template.\n");
      //   manimCode = llmCodeGenService.getFallbackManimCode(prompt);
    }

    // Stream generated code to client
    res.write("Generated Manim code:\n");
    res.write(manimCode);
    res.write("\n\nExecuting Manim animation...\n");

    // Step 2: Save Manim code to file
    jobStatus[jobId].progress = "Saving Manim code";

    console.log(manimCode);
    res.end();
  } catch (error: any) {
    console.error(`Error processing job ${jobId}:`, error);
    jobStatus[jobId] = {
      status: "failed",
      error: error.message,
    };

    // Send error to client
    res.write(`Error: ${error.message}`);
    res.end();
  }
}
