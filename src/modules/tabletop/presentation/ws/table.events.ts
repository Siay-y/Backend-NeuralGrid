export const TABLE_NAMESPACE = 'table';

export const TableClientEvent = {
  CreateToken: 'token:create',
  UpdateToken: 'token:update',
  MoveToken: 'token:move',
  DragToken: 'token:drag',
  DeleteToken: 'token:delete',
  SendMessage: 'chat:send',
  RollDice: 'dice:roll',
  ClearChat: 'chat:clear',
} as const;

export const TableServerEvent = {
  Snapshot: 'table:snapshot',
  TokenCreated: 'token:created',
  TokenUpdated: 'token:updated',
  TokenDeleted: 'token:deleted',
  TokenDragged: 'token:dragged',
  PresenceChanged: 'presence:changed',
  MessageCreated: 'chat:message',
  ChatCleared: 'chat:cleared',
  SessionExpired: 'session:expired',
} as const;

export const HANDSHAKE_UNAUTHORIZED = 'UNAUTHORIZED';

export const MASTERS_ROOM = 'role:master';

export function userRoom(userId: string): string {
  return `user:${userId}`;
}
