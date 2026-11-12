import { Injectable } from '@nestjs/common';
import type { StoredMapImage } from '../../domain/repositories/map.repository';

export const MAP_CACHE_BYTES = 32 * 1024 * 1024;

// Every player downloads the new map at the same moment a scene changes. A small
// in-memory cache turns those reads into one database read, which saves the
// monthly transfer quota of the free database plan.
@Injectable()
export class MapImageCache {
  private readonly entries = new Map<string, StoredMapImage>();
  private size = 0;

  get(key: string): StoredMapImage | undefined {
    const entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.entries.set(key, entry);
    }
    return entry;
  }

  set(key: string, image: StoredMapImage): void {
    if (image.bytes.length > MAP_CACHE_BYTES) {
      return;
    }
    this.delete(key);
    this.entries.set(key, image);
    this.size += image.bytes.length;
    for (const [oldest, entry] of this.entries) {
      if (this.size <= MAP_CACHE_BYTES) {
        break;
      }
      this.entries.delete(oldest);
      this.size -= entry.bytes.length;
    }
  }

  deleteArea(id: string): void {
    this.delete(`${id}:image`);
    this.delete(`${id}:thumbnail`);
  }

  private delete(key: string): void {
    const entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.size -= entry.bytes.length;
    }
  }
}
