import { Request, Response } from "express";
import { prisma } from "../db/db";
import { getSignedUrlForFile } from "../services/S3Services/getSignedUrlForFile";

type VideoIdRequest = Request<{ videoId: string }>;

export const getVideoUrl = async (
  req: VideoIdRequest,
  res: Response
): Promise<void> => {
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
        s3Key: true,
        s3Bucket: true,
      },
    });

    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const expiresIn = parseInt(req.query.expiresIn as string) || 3600; // Default 1 hour
    const signedUrl = await getSignedUrlForFile(
      video.s3Key,
      video.s3Bucket,
      expiresIn
    );

    res.json({
      url: signedUrl,
      fileName: video.fileName,
      expiresIn,
    });
  } catch (error) {
    console.error("Error generating video URL:", error);
    res.status(500).json({ error: "Failed to generate video URL" });
  }
};
