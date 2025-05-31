import { prisma } from "../db/db";
import { Request, Response } from "express";
import { getSignedUrlForFile } from "../services/S3Services/getSignedUrlForFile";

export const getVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoId } = req.params;
    const userId = req.user?.id; // Assuming user ID is set in the request by authentication middleware

    if (!videoId) {
      res.status(400).json({ error: "Video ID is required" });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: "User authentication required" });
      return;
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        fileName: true,
        fileType: true,
        s3Key: true,
        s3Bucket: true,
        manimProject: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    // Check if the video belongs to the authenticated user's project
    if (video.manimProject.userId !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const signedUrl = await getSignedUrlForFile(
      video.s3Key,
      video.s3Bucket,
      3600
    );

    res.redirect(signedUrl);
  } catch (error) {
    console.error("Error retrieving video:", error);
    res.status(500).json({ error: "Failed to retrieve video" });
  }
};
