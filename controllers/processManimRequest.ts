import path from "path";
import { generateManimCode } from "../services/llmCodeGenService";
import { Response } from "express";
import { saveManimCode } from "../utils/fileUtils";
import { runManimDocker } from "../services/dockerService";
import saveManimProject from "../db/saveManimProject";
import { cleanupTempFiles } from "../db/cleanupTempFiles";

// Helper function to get user-friendly error message
const getErrorMessage = (errorCode: string, originalMessage: string) => {
  switch (errorCode) {
    case "SERVICE_UNAVAILABLE":
      return "🚫 AI service is currently busy. Please try again in a few minutes.";
    case "QUOTA_EXCEEDED":
      return "⏳ API quota exceeded. Please try again later.";
    case "API_KEY_ERROR":
      return "🔑 Service configuration error. Please contact support.";
    case "NETWORK_ERROR":
      return "🌐 Network connectivity issue. Please check your connection and try again.";
    default:
      return `❌ Service temporarily unavailable: ${originalMessage}`;
  }
};

export const processManimRequest = async (
  jobId: string,
  prompt: string,
  res: Response,
  userId: string
) => {
  try {
    // Step 1: Generate Manim code using Gemini
    res.write("Generating Manim code with Gemini AI...\n");

    let manimCode: string;
    let explanation: string;

    try {
      // Updated to handle the new return format
      const result = await generateManimCode(prompt);

      if (result.success && result.code && result.explanation) {
        manimCode = result.code;
        explanation = result.explanation;
        res.write("✅ Generated code and explanation successfully.\n");
      } else {
        // Handle API error cases - end the process here
        const errorCode = result.error?.code || "UNKNOWN_ERROR";
        const errorMessage = getErrorMessage(
          errorCode,
          result.error?.message || "Unknown error"
        );

        console.error("Gemini API error:", result.error);
        res.write(`${errorMessage}\n`);
        res.write("Please try again later.\n");
        res.end();
        return;
      }
    } catch (geminiError) {
      console.error("Gemini API error:", geminiError);
      res.write(
        "🚫 AI service is currently unavailable. Please try again in a few minutes.\n"
      );
      res.end();
      return;
    }

    // Stream generated code info to client (don't stream the entire code as it's long)
    res.write("📝 Manim code generated successfully.\n");
    res.write(`📊 Code length: ${manimCode.length} characters\n`);
    res.write("🚀 Executing Manim animation...\n");

    // Step 2: Save Manim code to file
    console.log("Manim code type:", typeof manimCode);
    console.log("Manim code length:", manimCode.length);

    // Step 3: Run Docker container with Manim code
    const workDir = path.join(__dirname, "..", "temp", jobId);
    const pythonFilePath = await saveManimCode(workDir, manimCode);
    res.write("🐳 Running Manim in Docker container...\n");

    let outputPath: string;
    try {
      outputPath = await runManimDocker(workDir, pythonFilePath);
      console.log("Docker output path:", outputPath);
      res.write("✅ Manim execution completed successfully.\n");
    } catch (dockerError) {
      console.error("Docker execution error:", dockerError);
      res.write(`❌ Docker execution failed: ${dockerError}\n`);
      throw dockerError;
    }

    // Step 4: Save to database and S3
    res.write("💾 Saving project and videos to S3 and database...\n");

    try {
      await saveManimProject(
        jobId,
        prompt,
        manimCode,
        workDir,
        outputPath,
        explanation,
        userId
      );
      res.write(
        "✅ Successfully saved project and videos to S3 and database.\n"
      );
    } catch (dbError: any) {
      console.error("Database/S3 error:", dbError);
      res.write(
        `⚠️  Warning: Failed to save to S3/database: ${dbError.message}\n`
      );
      // Don't throw here - continue with cleanup
    }

    // Step 5: Clean up temporary files
    res.write("🧹 Cleaning up temporary files...\n");

    try {
      await cleanupTempFiles(workDir);
      res.write("✅ Temporary files cleaned up successfully.\n");
    } catch (cleanupError: any) {
      console.error("Cleanup error:", cleanupError);
      res.write(
        `⚠️  Warning: Failed to clean up temporary files: ${cleanupError.message}\n`
      );
      // Don't throw here - process is essentially complete
    }

    res.write(`🎉 Process completed successfully. Job ID: ${jobId}\n`);
    res.end();
  } catch (error: any) {
    console.error(`Error processing job ${jobId}:`, error);

    // Ensure we write a proper error message, never undefined
    const errorMessage = error?.message || "Unknown error occurred";
    res.write(`❌ Error: ${errorMessage}\n`);
    res.end();
  }
};
