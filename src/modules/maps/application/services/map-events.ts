import { Injectable } from '@nestjs/common';
import type { MapView } from '../dtos/map-view';

export interface MapUploadEvent {
  map: MapView;
  created: boolean;
}

type Listener = (event: MapUploadEvent) => void;

@Injectable()
export class MapEvents {
  private readonly listeners = new Set<Listener>();

  onUploaded(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  uploaded(event: MapUploadEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}
