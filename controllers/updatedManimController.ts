import { Request, Response } from "express";
import path from "path";
import { saveManimCode } from "../utils/fileUtils";
import { runManimDocker } from "../services/dockerService";
import { prisma } from "../db/db";
import { validateManimCode } from "../utils/codeValidator";
import fs from "fs";
import { saveAllVideo } from "../db/saveAllVideo";
import { cleanupTempFiles } from "../db/cleanupTempFiles";

export const updateManimCode = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { code } = req.body;
    const userId = req.user?.id; // Assuming user ID is set in the request by authentication middleware

    if (!projectId || !code) {
      res.status(400).json({
        error: "Project ID and updated code are required.",
      });
      return; // Added return statement to prevent further execution
    }

    if (!userId) {
      res.status(401).json({ error: "User authentication required" });
      return;
    }

    const existingProject = await prisma.manimProject.findUnique({
      where: { id: projectId, userId: userId },
      include: {
        videos: true, // Include existing videos for logging purposes
      },
    });

    if (!existingProject) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    console.log(
      `Updating project ${projectId} with ${existingProject.videos.length} existing videos`
    );

    // Validate the code (if your validator is ready)
    let validationResult;
    try {
      validationResult = await validateManimCode(code);
    } catch (validationError) {
      console.error("Code validation error:", validationError);
      validationResult = { isValid: true }; // Default to valid if validator fails
    }

    // 2. Set up response headers for streaming
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // 3. Create a temporary working directory
    const workDir = path.join(__dirname, "..", "temp", projectId);
    res.write("Preparing to update Manim code...\n");

    // Make sure the directory exists
    try {
      await fs.promises.mkdir(workDir, { recursive: true });
    } catch (mkdirError) {
      console.log("Directory creation warning:", mkdirError);
      // Continue as the directory might already exist
    }

    // 4. Save the updated code to a Python file
    res.write("Saving updated Manim code...\n");
    const pythonFilePath = await saveManimCode(workDir, code);
    res.write(`Code saved to ${pythonFilePath}\n`);

    if (validationResult.isValid) {
      // 5. Run Docker to generate new video
      res.write("Running Manim in Docker container to generate new video...\n");
      let outputPath;
      try {
        outputPath = await runManimDocker(workDir, pythonFilePath);
        res.write(`Video generation completed. Output: ${outputPath}\n`);
      } catch (dockerError: any) {
        res.write(
          `Warning: Docker execution encountered an error: ${dockerError.message}\n`
        );
        res.write("Proceeding with code update only...\n");
        outputPath = ""; // Set to empty if Docker fails
      }

      // 6. Update the project in the database
      res.write("Updating project code in database...\n");
      await prisma.manimProject.update({
        where: { id: projectId, userId: userId },
        data: {
          code: code,
          updatedAt: new Date(),
        },
      });

      // 7. Save the new video(s) to the database if Docker succeeded
      if (outputPath) {
        res.write("Saving new video to database...\n");
        try {
          // Use the improved saveAllVideo function that preserves existing videos
          await saveAllVideo(workDir, projectId, outputPath);
          res.write("Successfully saved new video to database.\n");

          // Log the updated count
          const updatedProject = await prisma.manimProject.findUnique({
            where: { id: projectId, userId: userId },
            include: { videos: true },
          });

          res.write(
            `Project now has ${updatedProject?.videos.length} videos (previously had ${existingProject.videos.length}).\n`
          );
        } catch (videoError: any) {
          res.write(
            `Warning: Error saving video to database: ${videoError.message}\n`
          );
          console.error("Video saving error details:", videoError);
        }
      } else {
        res.write("No video output was generated, skipping video save step.\n");
      }

      // 8. Clean up temporary files
      res.write("Cleaning up temporary files...\n");
      try {
        await cleanupTempFiles(workDir);
        res.write("Temporary files cleaned up successfully.\n");
      } catch (cleanupError: any) {
        res.write(
          `Warning: Failed to clean up temporary files: ${cleanupError.message}\n`
        );
      }

      res.write("Update completed successfully!\n");
      res.end();
    } else {
      res.write(
        "Error: Invalid Manim code. Please fix the errors and try again.\n"
      );
      res.write(
        validationResult.errors ||
          "Validation failed with no specific error message.\n"
      );
      res.end();
    }
  } catch (error: any) {
    console.error("Error updating Manim code:", error);

    // If headers haven't been sent, send a standard JSON error response
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: `Failed to update Manim code: ${error.message}` });
    } else {
      // If we were already streaming, write the error and end the response
      res.write(`Error: ${error.message}\n`);
      res.end();
    }
  }
};
