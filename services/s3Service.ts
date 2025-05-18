import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import { createReadStream } from "fs";

// Configure S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

// Default bucket name
const DEFAULT_BUCKET = process.env.AWS_S3_BUCKET || "";

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

export const deleteFileFromS3 = async (
  key: string,
  bucket: string = DEFAULT_BUCKET
): Promise<void> => {
  try {
    const deleteParams = {
      Bucket: bucket,
      Key: key,
    };

    await s3Client.send(new DeleteObjectCommand(deleteParams));
    console.log(`File deleted successfully from S3: ${bucket}/${key}`);
  } catch (error) {
    console.error("Error deleting file from S3:", error);
    throw new Error(`Failed to delete file from S3: ${error}`);
  }
};

export const getSignedUrlForFile = async (
  key: string,
  bucket: string = DEFAULT_BUCKET,
  expiresIn: number = 3600 // 1 hour in seconds
): Promise<string> => {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error("Error generating signed URL:", error);
    throw new Error(`Failed to generate signed URL: ${error}`);
  }
};

// Helper function to determine content type
function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();

  const mimeTypes: { [key: string]: string } = {
    ".mp4": "video/mp4",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
  };

  return mimeTypes[ext] || "application/octet-stream";
}

export default {
  uploadFileToS3,
  deleteFileFromS3,
  getSignedUrlForFile,
};
