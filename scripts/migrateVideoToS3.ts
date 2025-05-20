import { prisma } from "../src/db";
import fs from "fs";
import path from "path";
import os from "os";
import s3Service from "../services/s3Service";

const tempDir = path.join(os.tmpdir(), "video-migration");

async function ensureTempDirExists() {
  try {
    await fs.promises.mkdir(tempDir, { recursive: true });
    console.log(`Created temporary directory: ${tempDir}`);
  } catch (error) {
    console.error(`Error creating temporary directory: ${error}`);
    throw error;
  }
}

async function migrateVideosToS3() {
  try {
    console.log("Starting video migration to S3...");

    // Create temporary directory
    await ensureTempDirExists();

    // Get all videos with binary data
    const videos = await prisma.video.findMany({
      select: {
        id: true,
        fileName: true,
        data: true,
        manimProjectId: true,
      },
    });

    console.log(`Found ${videos.length} videos to migrate`);

    // Process each video
    for (const [index, video] of videos.entries()) {
      try {
        console.log(
          `Processing video ${index + 1}/${videos.length}: ${video.fileName}`
        );

        // Skip if no binary data
        if (!video.data) {
          console.log(`Video ${video.id} has no binary data, skipping`);
          continue;
        }

        // Write video data to temporary file
        const tempFilePath = path.join(tempDir, video.fileName);
        await fs.promises.writeFile(tempFilePath, video.data);

        // Generate S3 key based on project ID and filename
        const s3Key = `projects/${video.manimProjectId}/videos/${video.fileName}`;

        // Upload to S3
        const s3Result = await s3Service.uploadFileToS3(tempFilePath, s3Key);

        // Update database record - set S3 info and remove binary data
        await prisma.video.update({
          where: { id: video.id },
          data: {
            s3Key: s3Result.key,
            s3Bucket: s3Result.bucket,
            data: undefined, // Remove binary data from DB
          },
        });

        console.log(`Successfully migrated video ${video.id} to S3`);

        // Clean up temporary file
        await fs.promises.unlink(tempFilePath);
      } catch (error) {
        console.error(`Error migrating video ${video.id}:`, error);
        // Continue with next video
      }
    }

    console.log("Migration completed!");

    // Clean up temporary directory
    try {
      await fs.promises.rmdir(tempDir, { recursive: true });
      console.log(`Removed temporary directory: ${tempDir}`);
    } catch (cleanupError) {
      console.error(`Error cleaning up temporary directory: ${cleanupError}`);
    }
  } catch (error) {
    console.error("Error in migration process:", error);
    throw error;
  }
}

// Execute the migration if this file is run directly
if (require.main === module) {
  migrateVideosToS3()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

export default migrateVideosToS3;
