import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { BalanceModule } from './modules/balance/balance.module';
import { RequestModule } from './modules/request/request.module';
import { AdminModule } from './modules/admin/admin.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    BalanceModule,
    RequestModule,
    AdminModule,
  ],
})
export class AppModule {}
