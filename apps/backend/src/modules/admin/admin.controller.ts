import { Controller, Get, Post, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('sync-logs')
  @ApiOperation({ summary: 'View HCM sync history' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getSyncLogs(@Query('limit') limit?: number) {
    return this.adminService.getSyncLogs(limit ? Number(limit) : 50);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'View audit log' })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getAuditLogs(
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getAuditLogs(entityId, limit ? Number(limit) : 100);
  }

  @Get('discrepancies')
  @ApiOperation({ summary: 'List stale or mismatched balances' })
  getDiscrepancies() {
    return this.adminService.getDiscrepancies();
  }

  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger manual reconciliation against HCM' })
  reconcile() {
    return this.adminService.triggerReconcile();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get sync statistics dashboard data' })
  getStats() {
    return this.adminService.getSyncStats();
  }
}
