import path from "path";
import fs from "fs";
import { prisma } from "./db";
import { uploadFileToS3 } from "../services/S3Services/uploadFileToS3";
import { deleteFileFromS3 } from "../services/S3Services/deleteFileFromS3";

export const saveVideoFile = async (
  filePath: string,
  projectId: string,
  isOutput: boolean
) => {
  try {
    const fileName = path.basename(filePath);
    const fileType = path.extname(filePath).replace(".", "");
    const stats = await fs.promises.stat(filePath);
    const fileSize = stats.size;

    // Check if a video with the same name exists for this project
    const existingVideo = await prisma.video.findFirst({
      where: {
        fileName: fileName,
        manimProjectId: projectId,
      },
    });

    // Generate a project-specific S3 key for better organization
    const s3Key = `projects/${projectId}/videos/${fileName}`;

    // Upload to S3
    const s3Result = await uploadFileToS3(filePath, s3Key);

    if (existingVideo) {
      console.log(
        `Video ${fileName} already exists for this project, updating...`
      );

      // Delete the old file from S3 if the key is different
      if (existingVideo.s3Key !== s3Result.key) {
        try {
          await deleteFileFromS3(existingVideo.s3Key, existingVideo.s3Bucket);
        } catch (deleteError) {
          console.error(`Error deleting old S3 file: ${deleteError}`);
          // Continue with update even if delete fails
        }
      }

      // Update the existing video record
      await prisma.video.update({
        where: { id: existingVideo.id },
        data: {
          fileSize,
          s3Key: s3Result.key,
          s3Bucket: s3Result.bucket,
          isOutput,
        },
      });
    } else {
      const fileData = await fs.promises.readFile(filePath);
      await prisma.video.create({
        data: {
          fileName,
          fileType,
          fileSize,
          data: fileData,
          s3Key: s3Result.key,
          s3Bucket: s3Result.bucket,
          isOutput,
          manimProjectId: projectId,
        },
      });
    }

    console.log(
      `Saved video file: ${fileName} to S3 at ${s3Result.bucket}/${s3Result.key}`
    );
  } catch (error) {
    console.error(`Error saving video file ${filePath} to S3:`, error);
    throw error;
  }
};
