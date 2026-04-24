import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { Balance } from '../../database/entities/balance.entity';
import { HcmSyncLog } from '../../database/entities/hcm-sync-log.entity';
import { SyncModule } from '../sync/sync.module';
import { ReconcileScheduler } from '../sync/reconcile.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([Balance, HcmSyncLog]), SyncModule],
  controllers: [BalanceController],
  providers: [BalanceService, ReconcileScheduler],
  exports: [BalanceService],
})
export class BalanceModule {}
