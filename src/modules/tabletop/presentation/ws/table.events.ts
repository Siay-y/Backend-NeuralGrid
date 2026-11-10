export const TABLE_NAMESPACE = 'table';

export const TableClientEvent = {
  CreateToken: 'token:create',
  UpdateToken: 'token:update',
  MoveToken: 'token:move',
  DragToken: 'token:drag',
  DeleteToken: 'token:delete',
} as const;

export const TableServerEvent = {
  Snapshot: 'table:snapshot',
  TokenCreated: 'token:created',
  TokenUpdated: 'token:updated',
  TokenDeleted: 'token:deleted',
  TokenDragged: 'token:dragged',
  PresenceChanged: 'presence:changed',
  SessionExpired: 'session:expired',
} as const;

export const HANDSHAKE_UNAUTHORIZED = 'UNAUTHORIZED';
