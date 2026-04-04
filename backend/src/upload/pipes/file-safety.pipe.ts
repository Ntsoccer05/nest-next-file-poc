import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { fromBuffer } from 'file-type';

const BLOCKED_EXTENSIONS = new Set([
  'exe', 'dll', 'bat', 'cmd', 'sh', 'ps1',
  'vbs', 'jar', 'msi', 'com', 'scr', 'pif',
]);

const BLOCKED_MIMES = new Set([
  'application/x-msdownload',
  'application/x-executable',
  'application/x-sh',
  'application/java-archive',
]);

@Injectable()
export class FileSafetyPipe implements PipeTransform {
  async transform(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('ファイルが指定されていません');
    }

    // 拡張子チェック
    const originalName = file.originalname ?? '';
    const ext = originalName.split('.').pop()?.toLowerCase() ?? '';
    if (BLOCKED_EXTENSIONS.has(ext)) {
      throw new BadRequestException(
        `拡張子 .${ext} のファイルはアップロードできません`,
      );
    }

    // MIMEタイプチェック（multerが検出したもの）
    if (file.mimetype && BLOCKED_MIMES.has(file.mimetype)) {
      throw new BadRequestException(
        `MIMEタイプ ${file.mimetype} のファイルはアップロードできません`,
      );
    }

    // マジックバイトチェック
    const detected = await fromBuffer(file.buffer);
    if (detected && BLOCKED_MIMES.has(detected.mime)) {
      throw new BadRequestException(
        `ファイルの実体が危険なタイプ（${detected.mime}）です`,
      );
    }

    return file;
  }
}
