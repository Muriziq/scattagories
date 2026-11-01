import multer from "multer";
import path from "path";
import { Request } from "express";

// Strict whitelist of safe image extensions and MIME mappings
export const MIME_EXTENSION_MAP: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
};

// Use memory storage so the image buffer is held in memory for direct Cloudinary upload
const memoryStorage = multer.memoryStorage();

// Validate image file formats and strictly check extensions against MIME types
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedExts = MIME_EXTENSION_MAP[file.mimetype];
  const rawExt = path.extname(file.originalname).toLowerCase();

  if (allowedExts && allowedExts.includes(rawExt)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, WEBP, and GIF images with matching extensions are allowed"));
  }
};

// 2MB maximum file size limit
export const uploadAvatar = multer({
  storage: memoryStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter,
});
