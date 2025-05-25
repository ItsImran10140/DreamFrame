import path from "path";
import fs from "fs";
import { prisma } from "./db";
import { findMostRecentVideo } from "./findMostRecentVideo";
import { saveVideoFile } from "./saveVideoFile";

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

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.promises.access(path);
    return true;
  } catch {
    return false;
  }
}
