import { Request, Response } from "express";
import { prisma } from "../src/db";

/**
 * Fetches all ManimProjects and their associated videos
 *
 * @param req Express Request object
 * @param res Express Response object
 */
export const getAllManimProjects = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Optional query parameters for pagination and filtering
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalCount = await prisma.manimProject.count();

    // Fetch all projects with their videos
    const projects = await prisma.manimProject.findMany({
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
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

    // Send response with pagination metadata
    res.json({
      data: projects,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching all projects:", error);
    res.status(500).json({ error: "Failed to retrieve projects" });
  }
};

/**
 * Search ManimProjects by prompt text
 *
 * @param req Express Request object
 * @param res Express Response object
 */
export const searchManimProjects = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { query } = req.query;

    if (!query) {
      res.status(400).json({ error: "Search query is required" });
      return;
    }

    const projects = await prisma.manimProject.findMany({
      where: {
        prompt: {
          contains: query as string,
          mode: "insensitive", // Case insensitive search
        },
      },
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
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(projects);
  } catch (error) {
    console.error("Error searching projects:", error);
    res.status(500).json({ error: "Failed to search projects" });
  }
};
