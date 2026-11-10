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
import { AuthenticateAccessTokenUseCase } from '../../../auth/application/use-cases/authenticate-access-token.use-case';
import { ListUsersUseCase } from '../../../users/application/use-cases/list-users.use-case';
import type { TokenView } from '../../application/dtos/token-view';
import { AuthorizeTokenDragUseCase } from '../../application/use-cases/authorize-token-drag.use-case';
import { CreateTokenUseCase } from '../../application/use-cases/create-token.use-case';
import { DeleteTokenUseCase } from '../../application/use-cases/delete-token.use-case';
import { ListTokensUseCase } from '../../application/use-cases/list-tokens.use-case';
import { MoveTokenUseCase } from '../../application/use-cases/move-token.use-case';
import { UpdateTokenUseCase } from '../../application/use-cases/update-token.use-case';
import type { TableActor } from '../../domain/policies/token-policy';
import {
  CreateTokenDto,
  TokenIdDto,
  TokenPositionDto,
  UpdateTokenDto,
} from './dtos/token.dtos';
import { PresenceTracker } from './presence-tracker';
import { SocketRateLimiter } from './socket-rate-limiter';
import {
  HANDSHAKE_UNAUTHORIZED,
  TABLE_NAMESPACE,
  TableClientEvent,
  TableServerEvent,
} from './table.events';
import { parsePayload, RateLimitedError, type WsResult } from './ws-payload';

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

    try {
      const [tokens, users] = await Promise.all([
        this.listTokens.execute(),
        this.listUsers.execute(),
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
        ownerId: dto.ownerId ?? null,
        col: dto.col,
        row: dto.row,
        size: dto.size ?? 1,
      });
      this.server.emit(TableServerEvent.TokenCreated, token);
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
      const token = await this.updateToken.execute(actor, dto);
      this.server.emit(TableServerEvent.TokenUpdated, token);
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
      this.server.emit(TableServerEvent.TokenUpdated, token);
      return token;
    });
  }

  @SubscribeMessage(TableClientEvent.DragToken)
  drag(
    @ConnectedSocket() socket: TableSocket,
    @MessageBody() body: unknown,
  ): Promise<WsResult<null>> {
    return this.run(socket, async (actor) => {
      const dto = await parsePayload(TokenPositionDto, body);
      const preview = await this.authorizeDrag.execute(actor, dto);
      socket.broadcast.emit(TableServerEvent.TokenDragged, preview);
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
      const result = await this.deleteToken.execute(actor, dto.id);
      this.server.emit(TableServerEvent.TokenDeleted, result);
      return result;
    });
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
