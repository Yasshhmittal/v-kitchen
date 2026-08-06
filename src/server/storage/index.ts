import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { ApiError } from "@/server/api/response";

/**
 * Image storage behind one interface.
 *
 * The app only ever calls `getStorage()`. Today that returns the local-disk
 * provider; setting STORAGE_PROVIDER=cloudinary plus the three CLOUDINARY_*
 * env vars switches every upload path in the app with no other code change.
 */

export interface StoredFile {
  url: string;
  publicId: string;
  provider: "LOCAL" | "CLOUDINARY";
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
}

export interface StorageProvider {
  readonly name: "LOCAL" | "CLOUDINARY";
  upload(file: File, folder: string): Promise<StoredFile>;
  delete(publicId: string): Promise<void>;
}

/** Only real image types. Notably excludes SVG, which can carry script. */
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
};

/**
 * Magic-byte signatures. A browser-supplied Content-Type is trivially forged,
 * so the actual bytes decide whether we accept the file.
 */
const SIGNATURES: Array<{ mime: string; test: (b: Uint8Array) => boolean }> = [
  { mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  { mime: "image/gif", test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  {
    mime: "image/webp",
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  {
    // AVIF: "ftypavif" at offset 4.
    mime: "image/avif",
    test: (b) =>
      b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 &&
      b[8] === 0x61 && b[9] === 0x76 && b[10] === 0x69 && b[11] === 0x66,
  },
];

function maxUploadBytes(): number {
  return (Number.parseInt(process.env.MAX_UPLOAD_MB || "5", 10) || 5) * 1024 * 1024;
}

/** Validate size, declared type and actual bytes. Returns the sniffed MIME. */
export async function validateImage(file: File): Promise<{ bytes: Buffer; mimeType: string }> {
  if (file.size === 0) throw ApiError.badRequest("That file is empty.");
  if (file.size > maxUploadBytes()) {
    throw ApiError.badRequest(
      `Images must be under ${process.env.MAX_UPLOAD_MB || 5} MB. Try a smaller one.`,
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw ApiError.badRequest("Please upload a JPG, PNG, WebP, AVIF or GIF image.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sniffed = SIGNATURES.find((s) => s.test(bytes))?.mime;

  if (!sniffed) {
    throw ApiError.badRequest("That file doesn't look like an image.");
  }
  // JPEG is served under several type strings; otherwise the declared type
  // must agree with the bytes.
  if (sniffed !== file.type && !(sniffed === "image/jpeg" && file.type === "image/jpg")) {
    throw ApiError.badRequest("That file's contents don't match its type.");
  }

  return { bytes, mimeType: sniffed };
}

/** Random name — never the user's filename, which can carry path traversal. */
function safeFilename(mimeType: string): string {
  return `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}${
    EXTENSION_BY_MIME[mimeType] ?? ".bin"
  }`;
}

function safeFolder(folder: string): string {
  const cleaned = folder.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return cleaned || "general";
}

// ---------------------------------------------------------------------------
// Local disk
// ---------------------------------------------------------------------------

class LocalStorageProvider implements StorageProvider {
  readonly name = "LOCAL" as const;

  async upload(file: File, folder: string): Promise<StoredFile> {
    const { bytes, mimeType } = await validateImage(file);
    const dir = safeFolder(folder);
    const filename = safeFilename(mimeType);

    const absoluteDir = path.join(process.cwd(), "public", "uploads", dir);
    await mkdir(absoluteDir, { recursive: true });
    await writeFile(path.join(absoluteDir, filename), bytes);

    const publicId = `${dir}/${filename}`;
    return {
      url: `/uploads/${publicId}`,
      publicId,
      provider: "LOCAL",
      mimeType,
      sizeBytes: bytes.byteLength,
    };
  }

  async delete(publicId: string): Promise<void> {
    // Resolve and confirm the path stays inside the uploads directory, so a
    // crafted publicId cannot delete arbitrary files.
    const uploadsRoot = path.join(process.cwd(), "public", "uploads");
    const target = path.resolve(uploadsRoot, publicId);
    if (!target.startsWith(uploadsRoot + path.sep)) return;

    await unlink(target).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Cloudinary
// ---------------------------------------------------------------------------

/**
 * Signed upload via Cloudinary's REST API — no SDK dependency needed, and the
 * secret never leaves the server.
 */
class CloudinaryStorageProvider implements StorageProvider {
  readonly name = "CLOUDINARY" as const;

  constructor(
    private readonly cloudName: string,
    private readonly apiKey: string,
    private readonly apiSecret: string,
  ) {}

  private async sign(params: Record<string, string>): Promise<string> {
    const toSign = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");
    const digest = await crypto.subtle.digest(
      "SHA-1",
      new TextEncoder().encode(toSign + this.apiSecret),
    );
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  async upload(file: File, folder: string): Promise<StoredFile> {
    const { bytes, mimeType } = await validateImage(file);

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const cloudFolder = `v-kitchen/${safeFolder(folder)}`;
    const signature = await this.sign({ folder: cloudFolder, timestamp });

    const body = new FormData();
    body.append("file", new Blob([bytes], { type: mimeType }), safeFilename(mimeType));
    body.append("api_key", this.apiKey);
    body.append("timestamp", timestamp);
    body.append("folder", cloudFolder);
    body.append("signature", signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
      { method: "POST", body },
    );

    if (!response.ok) {
      console.error("[storage] cloudinary upload failed:", await response.text());
      throw ApiError.badRequest("The image couldn't be uploaded. Please try again.");
    }

    const result = (await response.json()) as {
      secure_url: string;
      public_id: string;
      bytes: number;
      width?: number;
      height?: number;
    };

    return {
      url: result.secure_url,
      publicId: result.public_id,
      provider: "CLOUDINARY",
      mimeType,
      sizeBytes: result.bytes,
      width: result.width,
      height: result.height,
    };
  }

  async delete(publicId: string): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await this.sign({ public_id: publicId, timestamp });

    const body = new FormData();
    body.append("public_id", publicId);
    body.append("api_key", this.apiKey);
    body.append("timestamp", timestamp);
    body.append("signature", signature);

    await fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`, {
      method: "POST",
      body,
    }).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------

let cached: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (cached) return cached;

  const { STORAGE_PROVIDER, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;

  if (STORAGE_PROVIDER === "cloudinary") {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new Error(
        "STORAGE_PROVIDER is 'cloudinary' but CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are not all set.",
      );
    }
    cached = new CloudinaryStorageProvider(
      CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET,
    );
  } else {
    cached = new LocalStorageProvider();
  }

  return cached;
}
