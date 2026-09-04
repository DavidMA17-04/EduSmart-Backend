import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { Repository } from 'typeorm';
import { SpecialtyKind } from '../../../../common/enums/specialty-kind.enum';
import { SpecialtyHubCoverEntity } from '../entities/specialty-hub-cover.entity';

export interface HubCoverDto {
  kind: SpecialtyKind;
  imageUrl: string | null;
}

@Injectable()
export class SpecialtyHubService {
  private readonly uploadDir = join(process.cwd(), 'uploads', 'specialty-hub');

  constructor(
    @InjectRepository(SpecialtyHubCoverEntity)
    private readonly coverRepo: Repository<SpecialtyHubCoverEntity>,
  ) {
    this.ensureUploadDir();
  }

  async listCovers(): Promise<HubCoverDto[]> {
    await this.ensureRows();
    const rows = await this.coverRepo.find();
    return Object.values(SpecialtyKind).map((kind) => {
      const row = rows.find((item) => item.kind === kind);
      const imageUrl = this.toPublicUrl(row?.imagePath ?? null);
      return { kind, imageUrl };
    });
  }

  async saveCover(kind: SpecialtyKind, file: Express.Multer.File): Promise<HubCoverDto> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Se requiere una imagen.');
    }

    const allowed = /^(image\/jpeg|image\/png|image\/webp)$/i;
    if (!allowed.test(file.mimetype)) {
      throw new BadRequestException('Solo se permiten imágenes JPEG, PNG o WebP.');
    }

    this.ensureUploadDir();
    await this.ensureRows();

    let row = await this.coverRepo.findOne({ where: { kind } });
    if (!row) {
      row = this.coverRepo.create({ kind, imagePath: null });
    }

    if (row.imagePath) {
      this.safeUnlink(join(process.cwd(), 'uploads', row.imagePath));
    }

    const ext = this.resolveExtension(file);
    const filename = `${kind}-${Date.now()}${ext}`;
    const absolutePath = join(this.uploadDir, filename);
    writeFileSync(absolutePath, file.buffer);

    if (!existsSync(absolutePath)) {
      throw new BadRequestException('No se pudo guardar la imagen en el servidor.');
    }

    const relativePath = `specialty-hub/${filename}`;
    row.imagePath = relativePath;
    await this.coverRepo.save(row);

    return {
      kind,
      imageUrl: this.toPublicUrl(relativePath),
    };
  }

  async clearCover(kind: SpecialtyKind): Promise<HubCoverDto> {
    await this.ensureRows();
    const row = await this.coverRepo.findOne({ where: { kind } });
    if (!row) {
      throw new NotFoundException(`Cover ${kind} not found`);
    }

    if (row.imagePath) {
      this.safeUnlink(join(process.cwd(), 'uploads', row.imagePath));
      row.imagePath = null;
      await this.coverRepo.save(row);
    }

    return { kind, imageUrl: null };
  }

  private toPublicUrl(imagePath: string | null): string | null {
    if (!imagePath) return null;
    const absolute = join(process.cwd(), 'uploads', imagePath);
    if (!existsSync(absolute)) return null;
    return `/uploads/${imagePath.replace(/\\/g, '/')}`;
  }

  private resolveExtension(file: Express.Multer.File): string {
    const fromName = extname(file.originalname || '').toLowerCase();
    if (fromName && /^\.(jpe?g|png|webp)$/.test(fromName)) return fromName;
    if (/png/i.test(file.mimetype)) return '.png';
    if (/webp/i.test(file.mimetype)) return '.webp';
    return '.jpg';
  }

  private ensureUploadDir(): void {
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  private async ensureRows(): Promise<void> {
    for (const kind of Object.values(SpecialtyKind)) {
      const existing = await this.coverRepo.findOne({ where: { kind } });
      if (!existing) {
        await this.coverRepo.save(this.coverRepo.create({ kind, imagePath: null }));
      }
    }
  }

  private safeUnlink(path: string): void {
    try {
      if (existsSync(path)) unlinkSync(path);
    } catch {
      // ignore missing/locked files
    }
  }
}
