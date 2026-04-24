import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'entity_type' })
  entityType: string;

  @Index()
  @Column({ name: 'entity_id' })
  entityId: string;

  @Column()
  action: string;

  @Index()
  @Column({ name: 'actor_id' })
  actorId: string;

  @Column({ name: 'actor_role' })
  actorRole: string;

  @Column({ name: 'before_state', type: 'text', nullable: true })
  beforeState: string | null; // JSON string

  @Column({ name: 'after_state', type: 'text', nullable: true })
  afterState: string | null; // JSON string

  @Column({ name: 'ip_address', type: 'text', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;
}
