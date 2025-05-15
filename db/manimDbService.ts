import { prisma } from "../src/db";
import fs from "fs";
import path from "path";

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

async function saveAllVideo(
  workDir: string,
  projectId: string,
  outPutVideoPath: string
) {
  try {
    if (outPutVideoPath && (await fileExists(outPutVideoPath))) {
      await saveVideoFile(outPutVideoPath, projectId, true);
    }

    const mediaDir = path.join(workDir, "media", "videos");

    if (await fileExists(mediaDir)) {
      const videoFiles = await findAllVideos(mediaDir);
      for (const videoPath of videoFiles) {
        // Skip the output video if it's in this path to avoid duplication
        if (videoPath !== outPutVideoPath) {
          await saveVideoFile(videoPath, projectId, false);
        }
      }
    }
  } catch (error) {
    console.error("Error saving videos:", error);
    throw new Error("Failed to save video files");
  }
}

function isVideoFile(fileName: string): boolean {
  const videoExtensions = [".mp4", ".avi", ".mov", ".mkv", ".webm"];
  return videoExtensions.includes(path.extname(fileName).toLowerCase());
}

async function findAllVideos(dir: string): Promise<string[]> {
  let results: string[] = [];

  try {
    const items = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        // Recursively search subdirectories
        const subResults = await findAllVideos(fullPath);
        results = [...results, ...subResults];
      } else if (isVideoFile(item.name)) {
        // If it's a video file, add it to the results
        results.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error finding videos in ${dir}:`, error);
  }

  return results;
}

async function saveVideoFile(
  filePath: string,
  projectId: string,
  isOutput: boolean
) {
  try {
    // Read the file data
    const fileData = await fs.promises.readFile(filePath);
    const fileSize = fileData.length;
    const fileName = path.basename(filePath);
    const fileType = path.extname(filePath).replace(".", "");

    // Save to database
    await prisma.video.create({
      data: {
        fileName,
        fileType,
        fileSize,
        data: fileData,
        isOutput,
        manimProjectId: projectId,
      },
    });

    console.log(`Saved video file: ${fileName}`);
  } catch (error) {
    console.error(`Error saving video file ${filePath}:`, error);
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

export default { saveManimProject, cleanupTempFiles };
