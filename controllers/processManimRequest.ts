import path from "path";
import { generateManimCode } from "../services/llmCodeGenService";
import { Response } from "express";
import { saveManimCode } from "../utils/fileUtils";
import { runManimDocker } from "../services/dockerService";
import saveManimProject from "../db/saveManimProject";
import { cleanupTempFiles } from "../db/cleanupTempFiles";

export const processManimRequest = async (
  jobId: string,
  prompt: string,
  res: Response,
  userId: string
) => {
  try {
    // Step 1: Generate Manim code using Gemini
    res.write("Generating Manim code with Gemini AI...\n");

    let manimCode;
    let explanation;
    try {
      // Updated to get both code and explanation
      const result = await generateManimCode(prompt);

      manimCode = result.code;
      explanation = result.explanation;

      if (explanation) {
        res.write("Generated code explanation successfully.\n");
      }
    } catch (geminiError) {
      console.error("Gemini API error:", geminiError);
      res.write("Gemini API error occurred. Using fallback code template.\n");
    }

    // Stream generated code to client
    res.write("Generated Manim code:\n");
    res.write(manimCode);
    res.write("\n\nExecuting Manim animation...\n");

    // Step 2: Save Manim code to file
    console.log(typeof manimCode);
    console.log(manimCode);

    // Step 3: Run Docker container with Manim code
    const workDir = path.join(__dirname, "..", "temp", jobId);
    const pythonFilePath = await saveManimCode(workDir, manimCode as string);
    res.write("Running Manim in Docker container...\n");

    const outputPath = await runManimDocker(workDir, pythonFilePath);
    console.log(outputPath);

    // Step 4: Save to database and S3
    res.write("Saving project and videos to S3 and database...\n");

    try {
      await saveManimProject(
        jobId,
        prompt,
        manimCode as string,
        workDir,
        outputPath,
        explanation ?? "",
        userId
      );
      res.write("Successfully saved project and videos to S3 and database. \n");
    } catch (dbError: any) {
      console.error("Database/S3 error:", dbError);
      res.write(`Warning: Failed to save to S3/database: ${dbError.message}\n`);
    }

    // Step 5: Clean up temporary files
    res.write("Cleaning up temporary files...\n");

    try {
      await cleanupTempFiles(workDir);
      res.write("Temporary files cleaned up successfully.\n");
    } catch (cleanupError: any) {
      console.error("Cleanup error:", cleanupError);
      res.write(
        `Warning: Failed to clean up temporary files: ${cleanupError.message}\n`
      );
    }
    res.write(`Process completed successfully. Job ID: ${jobId}\n`);
    res.end();
  } catch (error: any) {
    console.error(`Error processing job ${jobId}:`, error);
    res.write(`Error: ${error.message}`);
    res.end();
  }
};
