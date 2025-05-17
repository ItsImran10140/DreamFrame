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

/**
 * Save all videos found in the workDir to the database
 * This function ensures it doesn't create duplicate videos by checking filenames
 */
export const saveAllVideo = async (
  workDir: string,
  projectId: string,
  outPutVideoPath: string
) => {
  try {
    console.log(`Saving videos for project ${projectId} from ${workDir}`);
    console.log(`Main output video path: ${outPutVideoPath}`);

    // Get existing videos for this project to avoid duplicates
    const existingVideos = await prisma.video.findMany({
      where: { manimProjectId: projectId },
      select: { fileName: true },
    });

    const existingFileNames = new Set(existingVideos.map((v) => v.fileName));
    console.log(`Found ${existingFileNames.size} existing videos`);

    // Save the main output video if it exists
    if (outPutVideoPath && (await fileExists(outPutVideoPath))) {
      const fileName = path.basename(outPutVideoPath);

      // Only save if a video with this name doesn't already exist for this project
      if (!existingFileNames.has(fileName)) {
        console.log(`Saving main output video: ${fileName}`);
        await saveVideoFile(outPutVideoPath, projectId, true);
      } else {
        console.log(`Skipping existing main output video: ${fileName}`);
      }
    } else {
      console.log(`Main output video path doesn't exist: ${outPutVideoPath}`);
    }

    // Save all other videos in the media directory
    const mediaDir = path.join(workDir, "media", "videos");
    console.log(`Looking for additional videos in: ${mediaDir}`);

    if (await fileExists(mediaDir)) {
      const videoFiles = await findAllVideos(mediaDir);
      console.log(`Found ${videoFiles.length} video files in media directory`);

      for (const videoPath of videoFiles) {
        // Skip the output video if it's in this path to avoid duplication
        if (videoPath !== outPutVideoPath) {
          const fileName = path.basename(videoPath);

          // Only save if a video with this name doesn't already exist for this project
          if (!existingFileNames.has(fileName)) {
            console.log(`Saving additional video: ${fileName}`);
            await saveVideoFile(videoPath, projectId, false);
          } else {
            console.log(`Skipping existing additional video: ${fileName}`);
          }
        }
      }
    } else {
      console.log(`Media directory doesn't exist: ${mediaDir}`);
    }

    // Log the final count of videos for this project
    const updatedVideoCount = await prisma.video.count({
      where: { manimProjectId: projectId },
    });
    console.log(`Project now has ${updatedVideoCount} videos in total`);
  } catch (error) {
    console.error("Error saving videos:", error);
    throw new Error("Failed to save video files");
  }
};

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

    // Check if a video with the same name exists for this project
    const existingVideo = await prisma.video.findFirst({
      where: {
        fileName: fileName,
        manimProjectId: projectId,
      },
    });

    if (existingVideo) {
      console.log(
        `Video ${fileName} already exists for this project, updating...`
      );
      // Update the existing video
      await prisma.video.update({
        where: { id: existingVideo.id },
        data: {
          fileSize,
          data: fileData,
          isOutput,
        },
      });
    } else {
      // Create a new video entry
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
    }

    console.log(`Saved video file: ${fileName}`);
  } catch (error) {
    console.error(`Error saving video file ${filePath}:`, error);
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

// import { prisma } from "../src/db";
// import fs from "fs";
// import path from "path";

// export const saveManimProject = async (
//   jobId: string,
//   prompt: string,
//   code: string,
//   workDir: string,
//   outPutVideoPath: string
// ) => {
//   try {
//     const project = await prisma.manimProject.create({
//       data: {
//         id: jobId,
//         prompt,
//         code,
//       },
//     });
//     await saveAllVideo(workDir, project.id, outPutVideoPath);
//     return project.id;
//   } catch (error) {
//     console.error("Error saving Manim project to database:", error);
//     throw new Error("Failed to save project to database");
//   }
// };

// export const saveAllVideo = async (
//   workDir: string,
//   projectId: string,
//   outPutVideoPath: string
// ) => {
//   try {
//     if (outPutVideoPath && (await fileExists(outPutVideoPath))) {
//       await saveVideoFile(outPutVideoPath, projectId, true);
//     }

//     const mediaDir = path.join(workDir, "media", "videos");

//     if (await fileExists(mediaDir)) {
//       const videoFiles = await findAllVideos(mediaDir);
//       for (const videoPath of videoFiles) {
//         // Skip the output video if it's in this path to avoid duplication
//         if (videoPath !== outPutVideoPath) {
//           await saveVideoFile(videoPath, projectId, false);
//         }
//       }
//     }
//   } catch (error) {
//     console.error("Error saving videos:", error);
//     throw new Error("Failed to save video files");
//   }
// };

// function isVideoFile(fileName: string): boolean {
//   const videoExtensions = [".mp4", ".avi", ".mov", ".mkv", ".webm"];
//   return videoExtensions.includes(path.extname(fileName).toLowerCase());
// }

// async function findAllVideos(dir: string): Promise<string[]> {
//   let results: string[] = [];

//   try {
//     const items = await fs.promises.readdir(dir, { withFileTypes: true });

//     for (const item of items) {
//       const fullPath = path.join(dir, item.name);

//       if (item.isDirectory()) {
//         // Recursively search subdirectories
//         const subResults = await findAllVideos(fullPath);
//         results = [...results, ...subResults];
//       } else if (isVideoFile(item.name)) {
//         // If it's a video file, add it to the results
//         results.push(fullPath);
//       }
//     }
//   } catch (error) {
//     console.error(`Error finding videos in ${dir}:`, error);
//   }

//   return results;
// }

// async function saveVideoFile(
//   filePath: string,
//   projectId: string,
//   isOutput: boolean
// ) {
//   try {
//     // Read the file data
//     const fileData = await fs.promises.readFile(filePath);
//     const fileSize = fileData.length;
//     const fileName = path.basename(filePath);
//     const fileType = path.extname(filePath).replace(".", "");

//     // Save to database
//     await prisma.video.create({
//       data: {
//         fileName,
//         fileType,
//         fileSize,
//         data: fileData,
//         isOutput,
//         manimProjectId: projectId,
//       },
//     });

//     console.log(`Saved video file: ${fileName}`);
//   } catch (error) {
//     console.error(`Error saving video file ${filePath}:`, error);
//   }
// }

// async function fileExists(path: string): Promise<boolean> {
//   try {
//     await fs.promises.access(path);
//     return true;
//   } catch {
//     return false;
//   }
// }

// export const cleanupTempFiles = async (workDir: string) => {
//   try {
//     await fs.promises.rm(workDir, { recursive: true, force: true });
//   } catch (error) {
//     console.error(`Error cleaning up directory ${workDir}:`, error);
//   }
// };

// export default { saveManimProject, cleanupTempFiles, saveAllVideo };
