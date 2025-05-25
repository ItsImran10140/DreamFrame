import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { DEFAULT_BUCKET, s3Client } from "../S3Services/s3Service";

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
