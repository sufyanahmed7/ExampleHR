import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Balance } from './entities/balance.entity';
import { TimeOffRequest } from './entities/time-off-request.entity';
import { HcmSyncLog } from './entities/hcm-sync-log.entity';
import { AuditLog } from './entities/audit-log.entity';
import { User } from './entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'better-sqlite3',
        database: config.get<string>('database.path'),
        entities: [Balance, TimeOffRequest, HcmSyncLog, AuditLog, User],
        synchronize: config.get<string>('nodeEnv') !== 'production',
        logging: config.get<string>('nodeEnv') === 'development',
        prepareDatabase: (db: any) => {
          db.pragma('journal_mode = WAL');
          db.pragma('foreign_keys = ON');
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
