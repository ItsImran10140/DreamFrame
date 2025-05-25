import fs from "fs";

export const cleanupTempFiles = async (workDir: string) => {
  try {
    await fs.promises.rm(workDir, { recursive: true, force: true });
  } catch (error) {
    console.error(`Error cleaning up directory ${workDir}:`, error);
  }
};
