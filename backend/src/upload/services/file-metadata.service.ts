import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ExifTool, Tags } from 'exiftool-vendored';
import { fromBuffer } from 'file-type';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface FileMetadata {
  name: string;
  size: number;
  mimeType: string;
  // 解決済み日時（exif優先 → lastModified フォールバック）
  createdAt: string | null;
  modifiedAt: string | null;
  createdAtSource: 'exif' | 'lastModified' | 'unknown';
  // EXIFから取得した生の日時
  exifCreatedAt: string | null;
  exifModifiedAt: string | null;
  // ブラウザの File.lastModified（OSの更新日時に相当、作成日時はブラウザAPI非対応）
  clientLastModified: string | null;
  // EXIFタグ全件（シリアライズ可能な値のみ）
  exifTags: Record<string, unknown>;
  blocked: false;
}

@Injectable()
export class FileMetadataService implements OnModuleDestroy {
  private readonly exifTool = new ExifTool({ taskTimeoutMillis: 10000 });

  async onModuleDestroy() {
    await this.exifTool.end();
  }

  async extract(
    file: Express.Multer.File,
    clientLastModified?: number,
  ): Promise<FileMetadata> {
    const detected = await fromBuffer(file.buffer);
    const mimeType = detected?.mime ?? file.mimetype ?? 'application/octet-stream';

    const tmpPath = path.join(
      os.tmpdir(),
      `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    );

    let createdAt: string | null = null;
    let modifiedAt: string | null = null;
    let createdAtSource: FileMetadata['createdAtSource'] = 'unknown';
    let exifCreatedAt: string | null = null;
    let exifModifiedAt: string | null = null;
    let exifTags: Record<string, unknown> = {};

    try {
      fs.writeFileSync(tmpPath, file.buffer);

      const tags = await this.exifTool.read(tmpPath);
      exifTags = this.serializeTags(tags);

      // EXIF日時優先順位: CreateDate → DateTimeOriginal → TrackCreateDate → MediaCreateDate
      const exifDate =
        tags.CreateDate ??
        tags.DateTimeOriginal ??
        tags.TrackCreateDate ??
        tags.MediaCreateDate ??
        null;

      if (exifDate) {
        const parsed = this.parseExifDate(exifDate);
        if (parsed) {
          exifCreatedAt = parsed;
          createdAt = parsed;
          createdAtSource = 'exif';
        }
      }

      // EXIF更新日時: ModifyDate → MetadataDate
      const exifModifyDate = tags.ModifyDate ?? tags.MetadataDate ?? null;
      if (exifModifyDate) {
        const parsed = this.parseExifDate(exifModifyDate);
        if (parsed) {
          exifModifiedAt = parsed;
          modifiedAt = parsed;
        }
      }

      if (!createdAt && clientLastModified != null) {
        createdAt = new Date(clientLastModified).toISOString();
        createdAtSource = 'lastModified';
      }
      if (!modifiedAt && clientLastModified != null) {
        modifiedAt = new Date(clientLastModified).toISOString();
      }
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // 削除失敗は無視
      }
    }

    const clientLastModifiedIso =
      clientLastModified != null
        ? new Date(clientLastModified).toISOString()
        : null;

    return {
      name: file.originalname,
      size: file.size,
      mimeType,
      createdAt,
      modifiedAt,
      createdAtSource,
      exifCreatedAt,
      exifModifiedAt,
      clientLastModified: clientLastModifiedIso,
      exifTags,
      blocked: false,
    };
  }

  private parseExifDate(value: unknown): string | null {
    if (!value) return null;
    try {
      if (typeof value === 'object' && value !== null && 'toDate' in value) {
        const d = (value as { toDate: () => Date }).toDate();
        return d.toISOString();
      }
      if (typeof value === 'string') {
        const d = new Date(value);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
    } catch {
      // パース失敗
    }
    return null;
  }

  /** Buffer等JSONシリアライズ不可の値を除外し、日時は ISO 文字列に変換 */
  private serializeTags(tags: Tags): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(tags)) {
      if (value == null) continue;
      if (Buffer.isBuffer(value)) continue;
      if (typeof value === 'object' && 'toDate' in value) {
        const parsed = this.parseExifDate(value);
        result[key] = parsed;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // SourceFile などのオブジェクトは文字列化
        try {
          JSON.stringify(value);
          result[key] = value;
        } catch {
          result[key] = String(value);
        }
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}
