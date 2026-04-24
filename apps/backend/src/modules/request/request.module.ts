import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestController } from './request.controller';
import { RequestService } from './request.service';
import { TimeOffRequest } from '../../database/entities/time-off-request.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { User } from '../../database/entities/user.entity';
import { BalanceModule } from '../balance/balance.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeOffRequest, AuditLog, User]),
    BalanceModule,
    SyncModule,
  ],
  controllers: [RequestController],
  providers: [RequestService],
})
export class RequestModule {}
