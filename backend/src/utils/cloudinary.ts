import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import dotenv from "dotenv";
import crypto from "node:crypto";

dotenv.config();

// One-time module-level configuration
const isConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// Check if credentials are set
export function isCloudinaryConfigured(): boolean {
  return isConfigured;
}

/**
 * Computes an irreversible SHA-256 hash of the userId for public asset naming.
 * Prevents exposing internal database primary keys while maintaining deterministic 1-to-1 mapping.
 */
export function getAvatarPublicId(userId: string): string {
  const hash = crypto.createHash("sha256").update(userId).digest("hex");
  return `scatterblitz/avatars/user-${hash}`;
}

/**
 * Uploads a multer memory buffer directly using the official Cloudinary v2 upload_stream.
 * Automatically applies face-centered avatar cropping and WebP/auto-format optimization.
 */
export function uploadToCloudinary(
  buffer: Buffer,
  folder?: string,
  publicId?: string
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const uploadOptions: Record<string, any> = {
      overwrite: true,
      resource_type: "image",
      transformation: [
        { width: 300, height: 300, crop: "fill", gravity: "face" },
        { quality: "auto", fetch_format: "auto" },
      ],
    };

    if (folder) uploadOptions.folder = folder;
    if (publicId) uploadOptions.public_id = publicId;

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Cloudinary upload failed: No result returned"));
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Permanently deletes an image asset from Cloudinary by its publicId.
 */
export async function deleteFromCloudinary(publicId: string): Promise<any> {
  if (!isConfigured) return;
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
}

/**
 * Permanently deletes multiple image assets from Cloudinary in a single batch request.
 * Cloudinary Admin API supports up to 100 public IDs per call.
 */
export async function deleteBatchFromCloudinary(publicIds: string[]): Promise<any> {
  if (!isConfigured || !publicIds || publicIds.length === 0) return;
  return new Promise((resolve, reject) => {
    cloudinary.api.delete_resources(publicIds, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
}

export default cloudinary;
