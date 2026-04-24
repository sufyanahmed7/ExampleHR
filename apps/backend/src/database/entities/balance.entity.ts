import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Unique,
  Index,
} from 'typeorm';
import { Expose } from 'class-transformer';

@Entity('balances')
@Unique(['employeeId', 'locationId', 'leaveType'])
export class Balance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'employee_id' })
  employeeId: string;

  @Index()
  @Column({ name: 'location_id' })
  locationId: string;

  @Column({ name: 'leave_type' })
  leaveType: string;

  @Column({ name: 'total_days', type: 'real', default: 0 })
  totalDays: number;

  @Column({ name: 'used_days', type: 'real', default: 0 })
  usedDays: number;

  @Column({ name: 'pending_days', type: 'real', default: 0 })
  pendingDays: number;

  @Column({ name: 'last_synced_at', type: 'datetime', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ name: 'sync_run_id', type: 'text', nullable: true })
  syncRunId: string | null;

  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Expose()
  get availableDays(): number {
    return Math.max(0, this.totalDays - this.usedDays - this.pendingDays);
  }
}
