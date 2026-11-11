import { Injectable } from '@nestjs/common';

@Injectable()
export class PresenceTracker {
  private readonly socketsByUser = new Map<string, Set<string>>();

  join(userId: string, socketId: string): boolean {
    const sockets = this.socketsByUser.get(userId) ?? new Set<string>();
    const cameOnline = sockets.size === 0;
    sockets.add(socketId);
    this.socketsByUser.set(userId, sockets);
    return cameOnline;
  }

  leave(userId: string, socketId: string): boolean {
    const sockets = this.socketsByUser.get(userId);
    if (!sockets?.delete(socketId)) {
      return false;
    }
    if (sockets.size > 0) {
      return false;
    }
    this.socketsByUser.delete(userId);
    return true;
  }

  connectionCount(userId: string): number {
    return this.socketsByUser.get(userId)?.size ?? 0;
  }

  onlineUserIds(): string[] {
    return [...this.socketsByUser.keys()];
  }
}
