import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  UsePipes,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FileSafetyPipe } from './pipes/file-safety.pipe';
import { FileMetadataService } from './services/file-metadata.service';

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

@Controller('upload')
export class UploadController {
  constructor(private readonly metadataService: FileMetadataService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async upload(
    @UploadedFile(FileSafetyPipe) file: Express.Multer.File,
    @Body('lastModified') lastModified?: string,
  ) {
    const clientLastModified =
      lastModified != null && lastModified !== ''
        ? Number(lastModified)
        : undefined;

    return this.metadataService.extract(file, clientLastModified);
  }
}
