import { Request, Response } from "express";
import { prisma } from "../db/db";

export const getManimProject = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id; // Assuming user ID is set in the request by authentication middleware
    if (!projectId) {
      res.status(400).json({ error: "Project ID is required" });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: "User authentication required" });
      return;
    }

    const project = await prisma.manimProject.findUnique({
      where: { id: projectId, userId: userId },
      include: {
        videos: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileSize: true,
            isOutput: true,
            s3Key: true,
            s3Bucket: true,
            createdAt: true,
          },
        },
      },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(project);
  } catch (error) {
    console.error("Error retrieving project:", error);
    res.status(500).json({ error: "Failed to retrieve project" });
  }
};
