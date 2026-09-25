import { S3ObjectStorage } from "@/lib/storage/s3";
import {
  getSharedMemoryStorage,
  type ObjectStorage,
} from "@/lib/storage/types";

export type StorageBackend = "s3" | "memory";

export function resolveStorageBackend(): StorageBackend {
  if (
    process.env.S3_ENDPOINT &&
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY
  ) {
    return "s3";
  }
  return "memory";
}

let cached: ObjectStorage | null = null;

export function getObjectStorage(): ObjectStorage {
  if (cached) return cached;

  if (resolveStorageBackend() === "s3") {
    cached = new S3ObjectStorage({
      endpoint: process.env.S3_ENDPOINT!,
      region: process.env.S3_REGION ?? "us-east-1",
      bucket: process.env.S3_BUCKET!,
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    });
  } else {
    cached = getSharedMemoryStorage();
  }

  return cached;
}

/** Test helper to inject a storage instance. */
export function setObjectStorageForTests(storage: ObjectStorage | null): void {
  cached = storage;
}
