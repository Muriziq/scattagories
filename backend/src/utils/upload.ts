import multer from "multer";
import path from "path";
import fs from "fs";
import { Request } from "express";

// Ensure upload directories exist
const uploadDir = path.join(process.cwd(), "uploads", "avatars");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Strict whitelist of safe image extensions and MIME mappings
const MIME_EXTENSION_MAP: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
};

// Configure storage with sanitized unique file names and guaranteed safe extensions
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, uploadDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const user = (req as any).user;
    const userId = user?.id || "anonymous";
    const rawExt = path.extname(file.originalname).toLowerCase();
    const validExts = MIME_EXTENSION_MAP[file.mimetype] || [".png"];
    const ext = validExts.includes(rawExt) ? rawExt : validExts[0];
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `avatar-${userId}-${uniqueSuffix}${ext}`);
  },
});

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
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter,
});
