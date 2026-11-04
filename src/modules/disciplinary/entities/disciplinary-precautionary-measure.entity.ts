import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'disciplinary_precautionary_measures' })
export class DisciplinaryPrecautionaryMeasureEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_disciplinary_precautionary_measures' })
  id!: number;

  @Column({ name: 'id_disciplinary_cases', type: 'int' })
  caseId!: number;

  @Column({ name: 'starts_on', type: 'date' })
  startsOn!: string;

  @Column({ name: 'ends_on', type: 'date' })
  endsOn!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ name: 'pani_coordination', type: 'boolean', default: false })
  paniCoordination!: boolean;

  @Column({ name: 'id_users_ordered_by', type: 'int' })
  orderedByUserId!: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
