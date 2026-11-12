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
  CreateDrawing: 'drawing:create',
  EraseDrawings: 'drawing:erase',
  ClearDrawings: 'drawing:clear',
  MoveRuler: 'ruler:move',
  ClearRuler: 'ruler:clear',
  CreateSheet: 'sheet:create',
  UpdateSheet: 'sheet:update',
  DeleteSheet: 'sheet:delete',
  RenameMap: 'map:rename',
  ActivateMap: 'map:activate',
  DeleteMap: 'map:delete',
  UpdateArea: 'area:update',
  DeleteArea: 'area:delete',
  UpdateFog: 'fog:update',
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
  DrawingCreated: 'drawing:created',
  DrawingsErased: 'drawing:erased',
  RulerMoved: 'ruler:moved',
  RulerCleared: 'ruler:cleared',
  SheetCreated: 'sheet:created',
  SheetUpdated: 'sheet:updated',
  SheetDeleted: 'sheet:deleted',
  SheetStats: 'sheet:stats',
  MapCreated: 'map:created',
  MapUpdated: 'map:updated',
  MapDeleted: 'map:deleted',
  SceneChanged: 'scene:changed',
  FogChanged: 'fog:changed',
  SessionExpired: 'session:expired',
  ConnectionLimit: 'session:limit',
} as const;

export const HANDSHAKE_UNAUTHORIZED = 'UNAUTHORIZED';

export const MASTERS_ROOM = 'role:master';

export function userRoom(userId: string): string {
  return `user:${userId}`;
}
