import { prisma } from "../db/db";
import { Request, Response } from "express";
import { getSignedUrlForFile } from "../services/S3Services/getSignedUrlForFile";

export const getVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoId } = req.params;

    if (!videoId) {
      res.status(400).json({ error: "Video ID is required" });
      return;
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        fileName: true,
        fileType: true,
        s3Key: true,
        s3Bucket: true,
      },
    });

    if (!video) {
      res.status(404).json({ error: "Video not found" });
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
