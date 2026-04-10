const fs = require("fs");
const path = require("path");
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

let cachedClient = null;
let cachedBucket = null;
let cachedPublicUrl = "";

function normalizePublicUrl(url) {
  return typeof url === "string" ? url.replace(/\/$/, "") : "";
}

function loadR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = normalizePublicUrl(process.env.R2_PUBLIC_URL);
  if (
    !accountId ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucket ||
    !publicUrl
  ) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    cachedBucket = bucket;
    cachedPublicUrl = publicUrl;
  }
  return {
    client: cachedClient,
    bucket: cachedBucket,
    publicUrl: cachedPublicUrl,
  };
}

function isR2AvatarStorageEnabled() {
  return loadR2Config() !== null;
}

function safeAvatarExt(originalname) {
  const ext = path.extname(originalname || "").toLowerCase();
  const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
  return allowed.includes(ext) ? ext : ".jpg";
}

function avatarObjectKey(playerId, originalname) {
  const safe = safeAvatarExt(originalname);
  return `avatars/${playerId}-${Date.now()}${safe}`;
}

function keyFromR2PublicUrl(storedUrl, publicUrlBase) {
  const base = normalizePublicUrl(publicUrlBase);
  if (!storedUrl || typeof storedUrl !== "string" || !base) return null;
  if (!storedUrl.startsWith(base)) return null;
  const rest = storedUrl.slice(base.length).replace(/^\//, "");
  return rest || null;
}

async function uploadAvatarToR2(buffer, contentType, key) {
  const cfg = loadR2Config();
  if (!cfg) throw new Error("R2 is not configured");
  await cfg.client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    }),
  );
  return `${cfg.publicUrl}/${key}`;
}

function unlinkLocalUploadAvatar(avatarUrl) {
  if (!avatarUrl || typeof avatarUrl !== "string" || !avatarUrl.startsWith("/uploads/")) {
    return;
  }
  const rel = avatarUrl.replace(/^\//, "");
  const fp = path.join(__dirname, rel);
  if (fs.existsSync(fp)) {
    try {
      fs.unlinkSync(fp);
    } catch {
      /* ignore */
    }
  }
}

async function deleteR2Avatar(storedUrl) {
  const cfg = loadR2Config();
  if (!cfg) return;
  const key = keyFromR2PublicUrl(storedUrl, cfg.publicUrl);
  if (!key) return;
  try {
    await cfg.client.send(
      new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }),
    );
  } catch (e) {
    console.warn("R2 avatar delete:", e.message);
  }
}

/**
 * Removes avatar binary from storage (local disk or R2) for the given stored URL.
 */
async function removeStoredAvatar(avatarUrl) {
  if (!avatarUrl || typeof avatarUrl !== "string") return;
  if (avatarUrl.startsWith("/uploads/")) {
    unlinkLocalUploadAvatar(avatarUrl);
    return;
  }
  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
    await deleteR2Avatar(avatarUrl);
  }
}

module.exports = {
  isR2AvatarStorageEnabled,
  safeAvatarExt,
  avatarObjectKey,
  uploadAvatarToR2,
  removeStoredAvatar,
  unlinkLocalUploadAvatar,
};
