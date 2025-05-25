import { GetObjectCommand } from "@aws-sdk/client-s3";
import { DEFAULT_BUCKET, s3Client } from "../S3Services/s3Service";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
