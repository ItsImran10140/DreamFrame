import { prisma } from "../src/db";
import fs from "fs";
import path from "path";
import s3Service from "../services/s3Service";

export const saveManimProject = async (
  jobId: string,
  prompt: string,
  code: string,
  workDir: string,
  outPutVideoPath: string
) => {
  try {
    const project = await prisma.manimProject.create({
      data: {
        id: jobId,
        prompt,
        code,
      },
    });
    await saveAllVideo(workDir, project.id, outPutVideoPath);
    return project.id;
  } catch (error) {
    console.error("Error saving Manim project to database:", error);
    throw new Error("Failed to save project to database");
  }
};

/**
 * Save only the main output video file to S3 and store reference in the database
 * We keep the function name for compatibility but change its behavior
 */
export const saveAllVideo = async (
  workDir: string,
  projectId: string,
  outPutVideoPath: string
) => {
  try {
    console.log(`Saving main output video for project ${projectId}`);
    console.log(`Output video path: ${outPutVideoPath}`);

    // First check if the specified output path exists directly
    let videoExists = await fileExists(outPutVideoPath);

    // If the direct path doesn't exist, try to find output.mp4 in the workDir
    if (!videoExists) {
      console.log(
        `Output video not found at specified path: ${outPutVideoPath}`
      );
      console.log(`Looking for output.mp4 in work directory: ${workDir}`);

      // Check if output.mp4 exists directly in the workDir
      const potentialOutputPath = path.join(workDir, "output.mp4");
      if (await fileExists(potentialOutputPath)) {
        outPutVideoPath = potentialOutputPath;
        videoExists = true;
        console.log(`Found output.mp4 at: ${outPutVideoPath}`);
      } else {
        // Check in the media/videos directory which is where Manim typically puts output
        const mediaVideoDir = path.join(workDir, "media", "videos");
        if (await fileExists(mediaVideoDir)) {
          // Look for the most recently modified video file in the media directory
          // Assuming the final output is the last one generated
          const latestVideo = await findMostRecentVideo(mediaVideoDir);
          if (latestVideo) {
            outPutVideoPath = latestVideo;
            videoExists = true;
            console.log(`Found latest output video at: ${outPutVideoPath}`);
          }
        }
      }
    }

    if (videoExists) {
      const fileName = path.basename(outPutVideoPath);
      console.log(`Saving main output video: ${fileName}`);
      await saveVideoFile(outPutVideoPath, projectId, true);

      // Log success
      const updatedVideoCount = await prisma.video.count({
        where: { manimProjectId: projectId },
      });
      console.log(`Project now has ${updatedVideoCount} videos in total`);
    } else {
      console.error(`Could not find any output video for project ${projectId}`);
      throw new Error("No output video found");
    }
  } catch (error) {
    console.error("Error saving output video:", error);
    throw new Error("Failed to save output video file");
  }
};

function isVideoFile(fileName: string): boolean {
  const videoExtensions = [".mp4", ".avi", ".mov", ".mkv", ".webm"];
  return videoExtensions.includes(path.extname(fileName).toLowerCase());
}

async function findMostRecentVideo(dir: string): Promise<string | null> {
  try {
    let latestVideo: string | null = null;
    let latestTime = 0;

    const processDirectory = async (directory: string) => {
      const items = await fs.promises.readdir(directory, {
        withFileTypes: true,
      });

      for (const item of items) {
        const fullPath = path.join(directory, item.name);

        if (item.isDirectory()) {
          // Recursively search subdirectories
          await processDirectory(fullPath);
        } else if (isVideoFile(item.name)) {
          // Check if this is more recent than our current latest
          const stats = await fs.promises.stat(fullPath);
          if (stats.mtimeMs > latestTime) {
            latestTime = stats.mtimeMs;
            latestVideo = fullPath;
          }
        }
      }
    };

    await processDirectory(dir);
    return latestVideo;
  } catch (error) {
    console.error(`Error finding videos in ${dir}:`, error);
    return null;
  }
}

async function saveVideoFile(
  filePath: string,
  projectId: string,
  isOutput: boolean
) {
  try {
    const fileName = path.basename(filePath);
    const fileType = path.extname(filePath).replace(".", "");
    const stats = await fs.promises.stat(filePath);
    const fileSize = stats.size;

    // Check if a video with the same name exists for this project
    const existingVideo = await prisma.video.findFirst({
      where: {
        fileName: fileName,
        manimProjectId: projectId,
      },
    });

    // Generate a project-specific S3 key for better organization
    const s3Key = `projects/${projectId}/videos/${fileName}`;

    // Upload to S3
    const s3Result = await s3Service.uploadFileToS3(filePath, s3Key);

    if (existingVideo) {
      console.log(
        `Video ${fileName} already exists for this project, updating...`
      );

      // Delete the old file from S3 if the key is different
      if (existingVideo.s3Key !== s3Result.key) {
        try {
          await s3Service.deleteFileFromS3(
            existingVideo.s3Key,
            existingVideo.s3Bucket
          );
        } catch (deleteError) {
          console.error(`Error deleting old S3 file: ${deleteError}`);
          // Continue with update even if delete fails
        }
      }

      // Update the existing video record
      await prisma.video.update({
        where: { id: existingVideo.id },
        data: {
          fileSize,
          s3Key: s3Result.key,
          s3Bucket: s3Result.bucket,
          isOutput,
        },
      });
    } else {
      // Create a new video entry
      // Read the file data as Uint8Array for the 'data' field
      const fileData = await fs.promises.readFile(filePath);
      await prisma.video.create({
        data: {
          fileName,
          fileType,
          fileSize,
          data: fileData,
          s3Key: s3Result.key,
          s3Bucket: s3Result.bucket,
          isOutput,
          manimProjectId: projectId,
        },
      });
    }

    console.log(
      `Saved video file: ${fileName} to S3 at ${s3Result.bucket}/${s3Result.key}`
    );
  } catch (error) {
    console.error(`Error saving video file ${filePath} to S3:`, error);
    throw error; // Re-throw to be handled by caller
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.promises.access(path);
    return true;
  } catch {
    return false;
  }
}

export const cleanupTempFiles = async (workDir: string) => {
  try {
    await fs.promises.rm(workDir, { recursive: true, force: true });
  } catch (error) {
    console.error(`Error cleaning up directory ${workDir}:`, error);
  }
};

export default {
  saveManimProject,
  cleanupTempFiles,
  saveAllVideo, // Exported for use in the controller
};
