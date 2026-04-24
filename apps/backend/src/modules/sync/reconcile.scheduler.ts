import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BalanceService } from '../balance/balance.service';

@Injectable()
export class ReconcileScheduler {
  private readonly logger = new Logger(ReconcileScheduler.name);

  constructor(private readonly balanceService: BalanceService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleReconcile(): Promise<void> {
    this.logger.log('Scheduled reconciliation starting...');
    try {
      const result = await this.balanceService.reconcile();
      this.logger.log(`Reconciliation complete. Discrepancies found: ${result.discrepancies}`);
    } catch (err) {
      this.logger.error(`Scheduled reconciliation failed: ${(err as Error).message}`);
    }
  }
}
