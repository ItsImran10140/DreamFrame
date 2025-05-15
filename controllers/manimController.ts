import path from "path";
import llmCodeGenService from "../services/llmCodeGenService";
import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { saveManimCode } from "../utils/fileUtils";
import { runManimDocker } from "../services/dockerService";
import manimDbService from "../db/manimDbService";

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

    console.log(typeof manimCode);
    console.log(manimCode);
    // TODO: SAVE CODE TO DATABASE
    // Step 3: Run Docker container with Manim code
    jobStatus[jobId].progress = "Running Manim in Docker container";
    const workDir = path.join(__dirname, "..", "temp", jobId);
    const pythonFilePath = await saveManimCode(workDir, manimCode as string);
    //  // console.log(
    //   `Running Manim for job ${jobId}, pythonFilePath: ${pythonFilePath}`
    // );
    res.write("Running Manim in Docker container...\n");

    const outputPath = await runManimDocker(workDir, pythonFilePath);
    console.log("VIDEO OUTPUT \n");
    console.log(outputPath);
    console.log("VIDEO INPUT \n");

    try {
      await manimDbService.saveManimProject(
        jobId,
        prompt,
        manimCode as string,
        workDir,
        outputPath
      );
      res.write("Successfully saved project and videos to database.");
    } catch (dbError: any) {
      console.error("Database error:", dbError);
      res.write(`Warning: Failed to save to database: ${dbError.message}\n`);
    }

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
