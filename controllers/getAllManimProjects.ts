import { Request, Response } from "express";
import { prisma } from "../db/db";

// Extend the Request interface to include user information
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

export const getAllManimProjects = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    // Get the user ID from the authenticated request
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    // Optional query parameters for pagination and filtering
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination (filtered by user)
    const totalCount = await prisma.manimProject.count({
      where: {
        userId: userId, // Filter by the authenticated user's ID
      },
    });

    // Fetch projects belonging to the authenticated user only
    const projects = await prisma.manimProject.findMany({
      where: {
        userId: userId, // Filter by the authenticated user's ID
      },
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
    console.error("Error fetching user projects:", error);
    res.status(500).json({ error: "Failed to retrieve projects" });
  }
};

export const searchManimProjects = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { query } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    if (!query) {
      res.status(400).json({ error: "Search query is required" });
      return;
    }

    // Search only within the authenticated user's projects
    const projects = await prisma.manimProject.findMany({
      where: {
        AND: [
          {
            userId: userId, // Filter by the authenticated user's ID
          },
          {
            prompt: {
              contains: query as string,
              mode: "insensitive", // Case insensitive search
            },
          },
        ],
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
    console.error("Error searching user projects:", error);
    res.status(500).json({ error: "Failed to search projects" });
  }
};

// import { Request, Response } from "express";
// import { prisma } from "../db/db";

// export const getAllManimProjects = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     // Optional query parameters for pagination and filtering
//     const page = req.query.page ? parseInt(req.query.page as string) : 1;
//     const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
//     const skip = (page - 1) * limit;

//     // Get total count for pagination
//     const totalCount = await prisma.manimProject.count();

//     // Fetch all projects with their videos
//     const projects = await prisma.manimProject.findMany({
//       skip,
//       take: limit,
//       orderBy: {
//         createdAt: "desc",
//       },
//       include: {
//         videos: {
//           select: {
//             id: true,
//             fileName: true,
//             fileType: true,
//             fileSize: true,
//             isOutput: true,
//             s3Key: true,
//             s3Bucket: true,
//             createdAt: true,
//           },
//         },
//       },
//     });

//     // Send response with pagination metadata
//     res.json({
//       data: projects,
//       pagination: {
//         total: totalCount,
//         page,
//         limit,
//         pages: Math.ceil(totalCount / limit),
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching all projects:", error);
//     res.status(500).json({ error: "Failed to retrieve projects" });
//   }
// };

// export const searchManimProjects = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const { query } = req.query;

//     if (!query) {
//       res.status(400).json({ error: "Search query is required" });
//       return;
//     }

//     const projects = await prisma.manimProject.findMany({
//       where: {
//         prompt: {
//           contains: query as string,
//           mode: "insensitive", // Case insensitive search
//         },
//       },
//       include: {
//         videos: {
//           select: {
//             id: true,
//             fileName: true,
//             fileType: true,
//             fileSize: true,
//             isOutput: true,
//             s3Key: true,
//             s3Bucket: true,
//             createdAt: true,
//           },
//         },
//       },
//       orderBy: {
//         createdAt: "desc",
//       },
//     });

//     res.json(projects);
//   } catch (error) {
//     console.error("Error searching projects:", error);
//     res.status(500).json({ error: "Failed to search projects" });
//   }
// };
