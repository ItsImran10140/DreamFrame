import { prisma } from "../db/db";
import { saveAllVideo } from "./saveAllVideo";

export const saveManimProject = async (
  jobId: string,
  prompt: string,
  code: string,
  workDir: string,
  outPutVideoPath: string,
  explanation: string
) => {
  try {
    const project = await prisma.manimProject.create({
      data: {
        id: jobId,
        prompt,
        code,
        explanation,
      },
    });
    await saveAllVideo(workDir, project.id, outPutVideoPath);
    return project.id;
  } catch (error) {
    console.error("Error saving Manim project to database:", error);
    throw new Error("Failed to save project to database");
  }
};

export default saveManimProject;
