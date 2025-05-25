import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  DEFAULT_BUCKET,
  getContentType,
  s3Client,
} from "../S3Services/s3Service";
import path from "path";
import fs, { createReadStream } from "fs";

export const uploadFileToS3 = async (
  filePath: string,
  customKey?: string
): Promise<{
  key: string;
  bucket: string;
  fileSize: number;
}> => {
  try {
    // Generate S3 key from filename if not provided
    const fileName = path.basename(filePath);
    const key = customKey || `videos/${Date.now()}-${fileName}`;
    const bucket = DEFAULT_BUCKET;
    if (!bucket) {
      throw new Error("AWS_S3_BUCKET environment variable is not set.");
    }

    // Get file stats for size
    const stats = await fs.promises.stat(filePath);
    const fileSize = stats.size;

    // Create read stream from file
    const fileStream = createReadStream(filePath);

    // Upload to S3
    const uploadParams = {
      Bucket: bucket,
      Key: key,
      Body: fileStream,
      ContentType: getContentType(fileName),
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    console.log(`File uploaded successfully to S3: ${bucket}/${key}`);

    return {
      key,
      bucket,
      fileSize,
    };
  } catch (error) {
    console.error("Error uploading file to S3:", error);
    throw new Error(`Failed to upload file to S3: ${error}`);
  }
};
