import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { HcmSyncLog } from '../../database/entities/hcm-sync-log.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Balance } from '../../database/entities/balance.entity';
import { BalanceModule } from '../balance/balance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([HcmSyncLog, AuditLog, Balance]),
    BalanceModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
