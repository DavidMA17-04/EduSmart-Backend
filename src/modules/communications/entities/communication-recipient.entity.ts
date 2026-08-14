import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'communication_recipients' })
export class CommunicationRecipient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'communication_id', type: 'uniqueidentifier' })
  communicationId!: string;

  @Column({ name: 'recipient_id', type: 'uniqueidentifier' })
  recipientId!: string;

  @Column({ name: 'recipient_type', type: 'nvarchar', length: 50 })
  recipientType!: string;
}
