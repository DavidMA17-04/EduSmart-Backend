import {
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SpecialtyKind } from '../../../../common/enums/specialty-kind.enum';

@Entity({ name: 'specialty_hub_covers' })
export class SpecialtyHubCoverEntity {
  @PrimaryColumn({
    type: 'enum',
    enum: SpecialtyKind,
  })
  kind!: SpecialtyKind;

  @Column({ name: 'image_path', type: 'varchar', length: 500, nullable: true })
  imagePath!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
