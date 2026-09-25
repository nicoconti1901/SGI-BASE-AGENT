export type StoredObject = {
  body: Buffer;
  contentType: string;
};

export interface ObjectStorage {
  putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void>;
  getObject(key: string): Promise<StoredObject | null>;
  deleteObject(key: string): Promise<void>;
}

/** In-memory store for tests and local fallback when S3 is not configured. */
export class MemoryObjectStorage implements ObjectStorage {
  private readonly objects = new Map<string, StoredObject>();

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    this.objects.set(key, { body: Buffer.from(body), contentType });
  }

  async getObject(key: string): Promise<StoredObject | null> {
    const found = this.objects.get(key);
    if (!found) return null;
    return { body: Buffer.from(found.body), contentType: found.contentType };
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }

  clear(): void {
    this.objects.clear();
  }
}

let sharedMemory: MemoryObjectStorage | null = null;

export function getSharedMemoryStorage(): MemoryObjectStorage {
  if (!sharedMemory) {
    sharedMemory = new MemoryObjectStorage();
  }
  return sharedMemory;
}
