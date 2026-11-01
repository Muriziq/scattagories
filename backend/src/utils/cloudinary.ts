import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import dotenv from "dotenv";

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
 * Uploads a multer memory buffer directly using the official Cloudinary v2 upload_stream.
 * Automatically applies face-centered avatar cropping and WebP/auto-format optimization.
 */
export function uploadToCloudinary(
  buffer: Buffer,
  folder: string = "scatterblitz/avatars",
  publicId?: string
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
        transformation: [
          { width: 300, height: 300, crop: "fill", gravity: "face" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Cloudinary upload failed: No result returned"));
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
}

export default cloudinary;
