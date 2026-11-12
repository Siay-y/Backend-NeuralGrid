import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { minutes, Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { Roles } from '../../../auth/presentation/http/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/presentation/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../auth/application/dtos/auth-session';
import type { MapView } from '../../application/dtos/map-view';
import {
  AddMapAreaUseCase,
  ReadMapImageUseCase,
  type UploadAreaInput,
  UploadMapUseCase,
} from '../../application/use-cases/map-use-cases';
import { InvalidMapError } from '../../domain/errors/invalid-map.error';
import type { MapImageKind } from '../../domain/repositories/map.repository';
import { MAP_LIMITS } from '../../domain/value-objects/map-image';
import { UploadMapDto } from './dtos/upload-map.dto';

export const MAP_UPLOADS_PER_MINUTE = 10;

interface UploadedMapFiles {
  image?: Express.Multer.File[];
  thumbnail?: Express.Multer.File[];
}

const uploadInterceptor = FileFieldsInterceptor(
  [
    { name: 'image', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ],
  {
    storage: memoryStorage(),
    limits: {
      fileSize: MAP_LIMITS.imageBytes,
      files: 2,
      fields: 3,
      parts: 5,
      fieldSize: 1024,
    },
  },
);

const uuid = () => new ParseUUIDPipe({ version: '4' });

function uploadInput(
  body: UploadMapDto,
  files: UploadedMapFiles,
): UploadAreaInput {
  const image = files?.image?.[0]?.buffer;
  const thumbnail = files?.thumbnail?.[0]?.buffer;
  if (!image || !thumbnail) {
    throw new InvalidMapError('Envie o mapa e a miniatura');
  }
  const center =
    body.centerCol === undefined || body.centerRow === undefined
      ? undefined
      : { col: body.centerCol, row: body.centerRow };
  return { name: body.name, image, thumbnail, center };
}

@Controller('maps')
export class MapsController {
  constructor(
    private readonly upload: UploadMapUseCase,
    private readonly addArea: AddMapAreaUseCase,
    private readonly read: ReadMapImageUseCase,
  ) {}

  @Roles('master')
  @Throttle({ default: { limit: MAP_UPLOADS_PER_MINUTE, ttl: minutes(1) } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(uploadInterceptor)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UploadMapDto,
    @UploadedFiles() files: UploadedMapFiles,
  ): Promise<MapView> {
    return this.upload.execute(user, uploadInput(body, files));
  }

  @Roles('master')
  @Throttle({ default: { limit: MAP_UPLOADS_PER_MINUTE, ttl: minutes(1) } })
  @Post(':id/areas')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(uploadInterceptor)
  createArea(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid()) mapId: string,
    @Body() body: UploadMapDto,
    @UploadedFiles() files: UploadedMapFiles,
  ): Promise<MapView> {
    return this.addArea.execute(user, {
      mapId,
      ...uploadInput(body, files),
    });
  }

  @Get('areas/:id/image')
  image(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid()) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.send(user, id, 'image', response);
  }

  @Roles('master')
  @Get('areas/:id/thumbnail')
  thumbnail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid()) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.send(user, id, 'thumbnail', response);
  }

  private async send(
    user: AuthenticatedUser,
    id: string,
    kind: MapImageKind,
    response: Response,
  ): Promise<StreamableFile> {
    const { bytes, type } = await this.read.execute(user, id, kind);
    // An area image never changes after upload, so its id is a safe cache key.
    // The response is private because it was authorized for this user only.
    response.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    response.setHeader('Content-Security-Policy', "default-src 'none'");
    return new StreamableFile(bytes, {
      type,
      length: bytes.length,
      disposition: 'inline',
    });
  }
}
