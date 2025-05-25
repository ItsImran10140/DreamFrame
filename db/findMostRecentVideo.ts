import path from "path";
import fs from "fs";

export const findMostRecentVideo = async (
  dir: string
): Promise<string | null> => {
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
};

function isVideoFile(fileName: string): boolean {
  const videoExtensions = [".mp4", ".avi", ".mov", ".mkv", ".webm"];
  return videoExtensions.includes(path.extname(fileName).toLowerCase());
}
