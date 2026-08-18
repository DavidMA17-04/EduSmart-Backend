import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'communication_recipients' })
export class CommunicationRecipient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'communication_id', type: 'char', length: 36 })
  communicationId!: string;

  @Column({ name: 'recipient_id', type: 'char', length: 36 })
  recipientId!: string;

  @Column({ name: 'recipient_type', type: 'varchar', length: 50 })
  recipientType!: string;
}
