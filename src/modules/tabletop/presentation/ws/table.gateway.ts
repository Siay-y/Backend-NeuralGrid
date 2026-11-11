import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { DefaultEventsMap, Namespace, Socket } from 'socket.io';
import { DomainError } from '../../../../shared/domain/errors/domain-error';
import type { AuthenticatedUser } from '../../../auth/application/dtos/auth-session';
import type { MessageView } from '../../../chat/application/dtos/message-view';
import {
  type ChatCleared,
  ClearChatUseCase,
} from '../../../chat/application/use-cases/clear-chat.use-case';
import { ListRecentMessagesUseCase } from '../../../chat/application/use-cases/list-recent-messages.use-case';
import { RollDiceUseCase } from '../../../chat/application/use-cases/roll-dice.use-case';
import { SendMessageUseCase } from '../../../chat/application/use-cases/send-message.use-case';
import { AuthenticateAccessTokenUseCase } from '../../../auth/application/use-cases/authenticate-access-token.use-case';
import type { SheetView } from '../../../sheets/application/dtos/sheet-view';
import {
  CreateSheetUseCase,
  DeleteSheetUseCase,
  ListSheetsUseCase,
  type SheetRemoval,
  UpdateSheetUseCase,
} from '../../../sheets/application/use-cases/sheet-use-cases';
import { ListUsersUseCase } from '../../../users/application/use-cases/list-users.use-case';
import {
  type DrawingsErased,
  type DrawingView,
} from '../../application/dtos/drawing-view';
import {
  type TokenView,
  viewFor,
  viewForPlayers,
} from '../../application/dtos/token-view';
import { ClearDrawingsUseCase } from '../../application/use-cases/clear-drawings.use-case';
import { CreateDrawingUseCase } from '../../application/use-cases/create-drawing.use-case';
import { EraseDrawingsUseCase } from '../../application/use-cases/erase-drawings.use-case';
import { ListDrawingsUseCase } from '../../application/use-cases/list-drawings.use-case';
import { AuthorizeTokenDragUseCase } from '../../application/use-cases/authorize-token-drag.use-case';
import { CreateTokenUseCase } from '../../application/use-cases/create-token.use-case';
import { DeleteTokenUseCase } from '../../application/use-cases/delete-token.use-case';
import { ListTokensUseCase } from '../../application/use-cases/list-tokens.use-case';
import { MoveTokenUseCase } from '../../application/use-cases/move-token.use-case';
import { SyncSheetTokensUseCase } from '../../application/use-cases/sync-sheet-tokens.use-case';
import { UpdateTokenUseCase } from '../../application/use-cases/update-token.use-case';
import type { TableActor } from '../../domain/policies/token-policy';
import { RollDiceDto, SendMessageDto } from './dtos/chat.dtos';
import {
  ClearDrawingsDto,
  CreateDrawingDto,
  DrawingIdsDto,
  RulerDto,
} from './dtos/drawing.dtos';
import { CreateSheetDto, SheetIdDto, UpdateSheetDto } from './dtos/sheet.dtos';
import {
  CreateTokenDto,
  TokenIdDto,
  TokenPositionDto,
  UpdateTokenDto,
} from './dtos/token.dtos';
import { ActionCooldowns, type CooldownAction } from './action-cooldowns';
import { PresenceTracker } from './presence-tracker';
import { SocketRateLimiter } from './socket-rate-limiter';
import {
  HANDSHAKE_UNAUTHORIZED,
  MASTERS_ROOM,
  TABLE_NAMESPACE,
  TableClientEvent,
  TableServerEvent,
  userRoom,
} from './table.events';
import {
  CooldownError,
  parsePayload,
  RateLimitedError,
  type WsResult,
} from './ws-payload';

interface TableSocketData {
  user: AuthenticatedUser;
  expiresAt: number;
  limiter: SocketRateLimiter;
  expiryTimer?: ReturnType<typeof setTimeout>;
}

type TableSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  TableSocketData
>;

const RATE_LIMIT = { capacity: 30, refillPerSecond: 15 };

@WebSocketGateway({ namespace: TABLE_NAMESPACE })
export class TableGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server: Namespace;

  private readonly logger = new Logger(TableGateway.name);
  private readonly cooldowns = new ActionCooldowns();

  constructor(
    private readonly authenticate: AuthenticateAccessTokenUseCase,
    private readonly presence: PresenceTracker,
    private readonly listTokens: ListTokensUseCase,
    private readonly listUsers: ListUsersUseCase,
    private readonly createToken: CreateTokenUseCase,
    private readonly updateToken: UpdateTokenUseCase,
    private readonly moveToken: MoveTokenUseCase,
    private readonly authorizeDrag: AuthorizeTokenDragUseCase,
    private readonly deleteToken: DeleteTokenUseCase,
    private readonly listMessages: ListRecentMessagesUseCase,
    private readonly sendMessage: SendMessageUseCase,
    private readonly rollDice: RollDiceUseCase,
    private readonly clearChat: ClearChatUseCase,
    private readonly listDrawings: ListDrawingsUseCase,
    private readonly createDrawing: CreateDrawingUseCase,
    private readonly eraseDrawings: EraseDrawingsUseCase,
    private readonly clearDrawings: ClearDrawingsUseCase,
    private readonly listSheets: ListSheetsUseCase,
    private readonly createSheet: CreateSheetUseCase,
    private readonly updateSheet: UpdateSheetUseCase,
    private readonly deleteSheet: DeleteSheetUseCase,
    private readonly syncSheetTokens: SyncSheetTokensUseCase,
  ) {}

  afterInit(namespace: Namespace): void {
    namespace.use((socket: TableSocket, next) => {
      const token: unknown = socket.handshake.auth?.token;
      this.authenticate
        .execute(token)
        .then(({ user, expiresAt }) => {
          socket.data.user = user;
          socket.data.expiresAt = expiresAt.getTime();
          socket.data.limiter = new SocketRateLimiter(RATE_LIMIT);
          next();
        })
        .catch(() => next(new Error(HANDSHAKE_UNAUTHORIZED)));
    });
  }

  async handleConnection(socket: TableSocket): Promise<void> {
    const { user, expiresAt } = socket.data;
    socket.data.expiryTimer = setTimeout(
      () => {
        socket.emit(TableServerEvent.SessionExpired);
        socket.disconnect(true);
      },
      Math.max(0, expiresAt - Date.now()),
    );

    const cameOnline = this.presence.join(user.id, socket.id);
    void socket.join(
      user.role === 'master'
        ? [userRoom(user.id), MASTERS_ROOM]
        : [userRoom(user.id)],
    );

    try {
      const actor = { id: user.id, role: user.role };
      const [tokens, users, messages, drawings, sheets] = await Promise.all([
        this.listTokens.execute(actor),
        this.listUsers.execute(),
        this.listMessages.execute(actor),
        this.listDrawings.execute(),
        this.listSheets.execute(actor),
      ]);
      socket.emit(TableServerEvent.Snapshot, {
        you: user,
        tokens,
        members: users.map(({ id, displayName, role }) => ({
          id,
          displayName,
          role,
        })),
        online: this.presence.onlineUserIds(),
        messages,
        drawings,
        sheets,
      });
    } catch (error) {
      this.logger.error(error instanceof Error ? error.stack : String(error));
      socket.disconnect(true);
      return;
    }

    if (cameOnline) {
      socket.broadcast.emit(TableServerEvent.PresenceChanged, {
        online: this.presence.onlineUserIds(),
      });
    }
  }

  handleDisconnect(socket: TableSocket): void {
    clearTimeout(socket.data.expiryTimer);
    const user = socket.data.user;
    if (user && this.presence.leave(user.id, socket.id)) {
      this.server.emit(TableServerEvent.PresenceChanged, {
        online: this.presence.onlineUserIds(),
      });
    }
  }

  @SubscribeMessage(TableClientEvent.CreateToken)
  create(
    @ConnectedSocket() socket: TableSocket,
    @MessageBody() body: unknown,
  ): Promise<WsResult<TokenView>> {
    return this.run(socket, async (actor) => {
      const dto = await parsePayload(CreateTokenDto, body);
      const token = await this.createToken.execute(actor, {
        label: dto.label,
        kind: dto.kind,
        icon: dto.icon ?? null,
        sex: dto.sex ?? null,
        hidden: dto.hidden ?? false,
        nameHidden: dto.nameHidden ?? false,
        ownerId: dto.ownerId ?? null,
        sheetId: dto.sheetId ?? null,
        col: dto.col,
        row: dto.row,
        size: dto.size ?? 1,
      });
      this.publishToken(TableServerEvent.TokenCreated, token, true);
      return token;
    });
  }

  @SubscribeMessage(TableClientEvent.UpdateToken)
  update(
    @ConnectedSocket() socket: TableSocket,
    @MessageBody() body: unknown,
  ): Promise<WsResult<TokenView>> {
    return this.run(socket, async (actor) => {
      const dto = await parsePayload(UpdateTokenDto, body);
      const { token, wasHidden } = await this.updateToken.execute(actor, dto);
      this.publishToken(TableServerEvent.TokenUpdated, token, wasHidden);
      return token;
    });
  }

  @SubscribeMessage(TableClientEvent.MoveToken)
  move(
    @ConnectedSocket() socket: TableSocket,
    @MessageBody() body: unknown,
  ): Promise<WsResult<TokenView>> {
    return this.run(socket, async (actor) => {
      const dto = await parsePayload(TokenPositionDto, body);
      const token = await this.moveToken.execute(actor, dto);
      this.publishToken(TableServerEvent.TokenUpdated, token, token.hidden);
      return viewFor(actor, token);
    });
  }

  @SubscribeMessage(TableClientEvent.DragToken)
  drag(
    @ConnectedSocket() socket: TableSocket,
    @MessageBody() body: unknown,
  ): Promise<WsResult<null>> {
    return this.run(socket, async (actor) => {
      const dto = await parsePayload(TokenPositionDto, body);
      const { preview, hidden } = await this.authorizeDrag.execute(actor, dto);
      const audience = hidden ? socket.to(MASTERS_ROOM) : socket.broadcast;
      audience.emit(TableServerEvent.TokenDragged, preview);
      return null;
    });
  }

  @SubscribeMessage(TableClientEvent.DeleteToken)
  remove(
    @ConnectedSocket() socket: TableSocket,
    @MessageBody() body: unknown,
  ): Promise<WsResult<{ id: string }>> {
    return this.run(socket, async (actor) => {
      const dto = await parsePayload(TokenIdDto, body);
      const { id, wasHidden } = await this.deleteToken.execute(actor, dto.id);
      const audience = wasHidden ? this.server.to(MASTERS_ROOM) : this.server;
      audience.emit(TableServerEvent.TokenDeleted, { id });
      return { id };
    });
  }

  @SubscribeMessage(TableClientEvent.SendMessage)
  send(
    @ConnectedSocket() socket: TableSocket,
    @MessageBody() body: unknown,
  ): Promise<WsResult<MessageView>> {
    return this.run(socket, async (actor) => {
      const dto = await parsePayload(SendMessageDto, body);
      this.assertCooldown(actor, 'chat');
      const message = await this.sendMessage.execute(actor, {
        text: dto.text,
        visibility: dto.visibility,
        recipientId: dto.recipientId ?? null,
      });
      this.deliver(message);
      return message;
    });
  }

  @SubscribeMessage(TableClientEvent.RollDice)
  roll(
    @ConnectedSocket() socket: TableSocket,
    @MessageBody() body: unknown,
  ): Promise<WsResult<MessageView>> {
    return this.run(socket, async (actor) => {
      const dto = await parsePayload(RollDiceDto, body);
      this.assertCooldown(actor, 'dice');
      const message = await this.rollDice.execute(actor, {
        expression: dto.expression,
        label: dto.label ?? null,
        visibility: dto.visibility,
        recipientId: dto.recipientId ?? null,
      });
      this.deliver(message);
      return message;
    });
  }

  @SubscribeMessage(TableClientEvent.ClearChat)
  clear(
    @ConnectedSocket() socket: TableSocket,
  ): Promise<WsResult<ChatCleared>> {
    return this.run(socket, async (actor) => {
      const cleared = await this.clearChat.execute(actor);
      this.server.emit(TableServerEvent.ChatCleared, cleared);
      return cleared;
    });
  }

  @SubscribeMessage(TableClientEvent.CreateDrawing)
  draw(
    @ConnectedSocket() socket: TableSocket,
    @MessageBody() body: unknown,
  ): Promise<WsResult<DrawingView>> {
    return this.run(socket, async (actor) => {
      const dto = await parsePayload(CreateDrawingDto, body);
      const drawing = await this.createDrawing.execute(actor, dto);
      socket.broadcast.emit(TableServerEvent.DrawingCreated, drawing);
      return drawing;
    });
  }

  @SubscribeMessage(TableClientEvent.EraseDrawings)
  erase(
    @ConnectedSocket() socket: TableSocket,
    @MessageBody() body: unknown,
  ): Promise<WsResult<DrawingsErased>> {
    return this.run(socket, async (actor) => {
      const dto = await parsePayload(DrawingIdsDto, body);
      const erased = await this.eraseDrawings.execute(actor, dto.ids);
      this.announceErased(socket, erased);
      return erased;
    });
  }

  @SubscribeMessage(TableClientEvent.ClearDrawings)
  clearBoard(
    @ConnectedSocket() socket: TableSocket,
    @MessageBody() body: unknown,
  ): Promise<WsResult<DrawingsErased>> {
    return this.run(socket, async (actor) => {
      const dto = await parsePayload(ClearDrawingsDto, body);
      const erased = await this.clearDrawings.execute(actor, dto.scope);
      this.announceErased(socket, erased);
      return erased;
    });
  }

  @SubscribeMessage(TableClientEvent.MoveRuler)
  measure(
    @ConnectedSocket() socket: TableSocket,
    @MessageBody() body: unknown,
  ): Promise<WsResult<null>> {
    return this.run(socket, async (actor) => {
      const dto = await parsePayload(RulerDto, body);
      socket.broadcast.emit(TableServerEvent.RulerMoved, {
        by: actor.id,
        fromCol: dto.fromCol,
        fromRow: dto.fromRow,
        toCol: dto.toCol,
        toRow: dto.toRow,
      });
      return null;
    });
  }

  @SubscribeMessage(TableClientEvent.ClearRuler)
  stopMeasuring(
    @ConnectedSocket() socket: TableSocket,
  ): Promise<WsResult<null>> {
    return this.run(socket, (actor) => {
      socket.broadcast.emit(TableServerEvent.RulerCleared, { by: actor.id });
      return Promise.resolve(null);
    });
  }

  @SubscribeMessage(TableClientEvent.CreateSheet)
  newSheet(
    @ConnectedSocket() socket: TableSocket,
    @MessageBody() body: unknown,
  ): Promise<WsResult<SheetView>> {
    return this.run(socket, async (actor) => {
      const dto = await parsePayload(CreateSheetDto, body);
      const sheet = await this.createSheet.execute(actor, dto);
      this.sheetAudience(sheet.ownerId).emit(
        TableServerEvent.SheetCreated,
        sheet,
      );
      return sheet;
    });
  }

  @SubscribeMessage(TableClientEvent.UpdateSheet)
  editSheet(
    @ConnectedSocket() socket: TableSocket,
    @MessageBody() body: unknown,
  ): Promise<WsResult<SheetView>> {
    return this.run(socket, async (actor) => {
      const dto = await parsePayload(UpdateSheetDto, body);
      const { sheet, previousOwnerId, identityChanged } =
        await this.updateSheet.execute(actor, dto);
      if (previousOwnerId !== null && previousOwnerId !== sheet.ownerId) {
        this.server
          .to(userRoom(previousOwnerId))
          .except(MASTERS_ROOM)
          .emit(TableServerEvent.SheetDeleted, { id: sheet.id });
      }
      this.sheetAudience(sheet.ownerId).emit(
        TableServerEvent.SheetUpdated,
        sheet,
      );
      if (identityChanged) {
        for (const token of await this.syncSheetTokens.execute(sheet)) {
          this.publishToken(TableServerEvent.TokenUpdated, token, token.hidden);
        }
      }
      return sheet;
    });
  }

  @SubscribeMessage(TableClientEvent.DeleteSheet)
  removeSheet(
    @ConnectedSocket() socket: TableSocket,
    @MessageBody() body: unknown,
  ): Promise<WsResult<SheetRemoval>> {
    return this.run(socket, async (actor) => {
      const dto = await parsePayload(SheetIdDto, body);
      const removal = await this.deleteSheet.execute(actor, dto.id);
      this.sheetAudience(removal.ownerId).emit(TableServerEvent.SheetDeleted, {
        id: removal.id,
      });
      return removal;
    });
  }

  private sheetAudience(ownerId: string | null) {
    return this.server.to(
      ownerId === null ? [MASTERS_ROOM] : [MASTERS_ROOM, userRoom(ownerId)],
    );
  }

  private assertCooldown(actor: TableActor, action: CooldownAction): void {
    const retryAfterMs = this.cooldowns.take(actor.id, action);
    if (retryAfterMs > 0) {
      throw new CooldownError(retryAfterMs);
    }
  }

  private announceErased(socket: TableSocket, erased: DrawingsErased): void {
    if (erased.ids.length > 0) {
      socket.broadcast.emit(TableServerEvent.DrawingsErased, erased);
    }
  }

  private publishToken(
    event: string,
    token: TokenView,
    wasHidden: boolean,
  ): void {
    this.server.to(MASTERS_ROOM).emit(event, token);
    const players = this.server.except(MASTERS_ROOM);
    if (!token.hidden) {
      players.emit(event, viewForPlayers(token));
    } else if (!wasHidden) {
      players.emit(TableServerEvent.TokenDeleted, { id: token.id });
    }
  }

  private deliver(message: MessageView): void {
    if (message.visibility === 'public') {
      this.server.emit(TableServerEvent.MessageCreated, message);
      return;
    }
    const rooms = [message.authorId, message.recipientId]
      .filter((id): id is string => id !== null)
      .map(userRoom);
    if (message.visibility === 'gm') {
      rooms.push(MASTERS_ROOM);
    }
    this.server.to(rooms).emit(TableServerEvent.MessageCreated, message);
  }

  private async run<T>(
    socket: TableSocket,
    action: (actor: TableActor) => Promise<T>,
  ): Promise<WsResult<T>> {
    if (!socket.data.limiter.tryConsume()) {
      const error = new RateLimitedError();
      return { ok: false, error: { code: error.code, message: error.message } };
    }

    try {
      const { id, role } = socket.data.user;
      return { ok: true, data: await action({ id, role }) };
    } catch (error) {
      if (error instanceof CooldownError) {
        return {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
            retryAfterMs: error.retryAfterMs,
          },
        };
      }
      if (error instanceof DomainError) {
        return {
          ok: false,
          error: { code: error.code, message: error.message },
        };
      }
      this.logger.error(error instanceof Error ? error.stack : String(error));
      return {
        ok: false,
        error: { code: 'INTERNAL', message: 'Erro interno do servidor' },
      };
    }
  }
}
