import path from "path";
import llmCodeGenService from "../services/llmCodeGenService";
import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { saveManimCode } from "../utils/fileUtils";
import { runManimDocker } from "../services/dockerService";
import manimDbService from "../db/manimDbService";
import { prisma } from "../src/db";
import s3Service from "../services/s3Service";

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
    let explanation;
    try {
      // Updated to get both code and explanation
      // const result = await llmCodeGenService.generateManimCode(prompt);
      const result = await llmCodeGenService.generateManimCode(prompt);

      manimCode = result.code;
      explanation = result.explanation;

      // manimCode = result.code;
      // explanation = result.explanation;

      // Stream a notice about the explanation being generated
      if (explanation) {
        res.write("Generated code explanation successfully.\n");
      }
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

    // Step 3: Run Docker container with Manim code
    jobStatus[jobId].progress = "Running Manim in Docker container";
    const workDir = path.join(__dirname, "..", "temp", jobId);
    const pythonFilePath = await saveManimCode(workDir, manimCode as string);
    res.write("Running Manim in Docker container...\n");

    const outputPath = await runManimDocker(workDir, pythonFilePath);
    console.log("VIDEO OUTPUT \n");
    console.log(outputPath);
    console.log("VIDEO INPUT \n");

    // Step 4: Save to database and S3
    jobStatus[jobId].progress = "Saving project and videos to S3 and database";
    res.write("Saving project and videos to S3 and database...\n");

    try {
      // Updated to include explanation in the saved project
      await manimDbService.saveManimProject(
        jobId,
        prompt,
        manimCode as string,
        workDir,
        outputPath,
        explanation ?? "" // Ensure explanation is always a string
      );
      res.write("Successfully saved project and videos to S3 and database. \n");
    } catch (dbError: any) {
      console.error("Database/S3 error:", dbError);
      res.write(`Warning: Failed to save to S3/database: ${dbError.message}\n`);
    }

    // Step 5: Clean up temporary files
    jobStatus[jobId].progress = "Cleaning up temporary files";
    res.write("Cleaning up temporary files...\n");

    try {
      await manimDbService.cleanupTempFiles(workDir);
      res.write("Temporary files cleaned up successfully.\n");
    } catch (cleanupError: any) {
      console.error("Cleanup error:", cleanupError);
      res.write(
        `Warning: Failed to clean up temporary files: ${cleanupError.message}\n`
      );
    }

    // Step 6: Finalize response
    jobStatus[jobId] = {
      status: "Completed",
      outputPath: outputPath,
    };

    res.write(`Process completed successfully. Job ID: ${jobId}\n`);
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

export const getManimProject = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { projectId } = req.params;
    if (!projectId) {
      res.status(400).json({ error: "Project ID is required" });
      return;
    }

    const project = await prisma.manimProject.findUnique({
      where: { id: projectId },
      include: {
        videos: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileSize: true,
            isOutput: true,
            s3Key: true,
            s3Bucket: true,
            createdAt: true,
          },
        },
      },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Don't include S3 URLs directly in the response to preserve security
    // Let the frontend request specific video URLs as needed
    res.json(project);
  } catch (error) {
    console.error("Error retrieving project:", error);
    res.status(500).json({ error: "Failed to retrieve project" });
  }
};

export const getVideoUrl = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { videoId } = req.params;

    if (!videoId) {
      res.status(400).json({ error: "Video ID is required" });
      return;
    }

    // Get video S3 information
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        fileName: true,
        s3Key: true,
        s3Bucket: true,
      },
    });

    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    // Generate a pre-signed URL for secure access
    const expiresIn = parseInt(req.query.expiresIn as string) || 3600; // Default 1 hour
    const signedUrl = await s3Service.getSignedUrlForFile(
      video.s3Key,
      video.s3Bucket,
      expiresIn
    );

    res.json({
      url: signedUrl,
      fileName: video.fileName,
      expiresIn,
    });
  } catch (error) {
    console.error("Error generating video URL:", error);
    res.status(500).json({ error: "Failed to generate video URL" });
  }
};

// For backward compatibility - redirect to the new method that uses signed URLs
export const getVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoId } = req.params;

    if (!videoId) {
      res.status(400).json({ error: "Video ID is required" });
      return;
    }

    // Get video S3 information
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        fileName: true,
        fileType: true,
        s3Key: true,
        s3Bucket: true,
      },
    });

    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    // Generate a pre-signed URL and redirect
    const signedUrl = await s3Service.getSignedUrlForFile(
      video.s3Key,
      video.s3Bucket,
      3600 // 1 hour expiry
    );

    // Redirect the client to the signed URL
    res.redirect(signedUrl);
  } catch (error) {
    console.error("Error retrieving video:", error);
    res.status(500).json({ error: "Failed to retrieve video" });
  }
};
