import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { FileMetadataService } from './services/file-metadata.service';

@Module({
  controllers: [UploadController],
  providers: [FileMetadataService],
})
export class UploadModule {}
