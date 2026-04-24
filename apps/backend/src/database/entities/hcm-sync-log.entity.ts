import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum SyncType {
  REALTIME = 'REALTIME',
  BATCH = 'BATCH',
  RECONCILE = 'RECONCILE',
}

export enum SyncStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL',
}

@Entity('hcm_sync_logs')
export class HcmSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sync_type', type: 'text', enum: SyncType })
  syncType: SyncType;

  @Column({ name: 'sync_run_id', type: 'text', nullable: true })
  syncRunId: string | null;

  @Index()
  @Column({ type: 'text', enum: SyncStatus })
  status: SyncStatus;

  @Column({ name: 'records_processed', type: 'integer', default: 0 })
  recordsProcessed: number;

  @Column({ name: 'records_updated', type: 'integer', default: 0 })
  recordsUpdated: number;

  @Column({ name: 'payload_hash', type: 'text', nullable: true })
  payloadHash: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'employee_id', type: 'text', nullable: true })
  employeeId: string | null;

  @Column({ name: 'discrepancies_found', type: 'integer', default: 0 })
  discrepanciesFound: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
