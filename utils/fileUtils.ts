import fs from "fs";
import path from "path";

export const saveManimCode = async (workDir: any, code: string) => {
  try {
    await fs.promises.mkdir(workDir, { recursive: true });
    const pythonFilePath = path.join(workDir, "scene.py");
    await fs.promises.writeFile(pythonFilePath, code);
    return pythonFilePath;
  } catch (error) {
    console.error("Error saving Manim code:", error);
    throw new Error("Failed to save Manim code");
  }
};
