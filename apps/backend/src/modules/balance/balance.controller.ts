import {
  Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BalanceService } from './balance.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { IngestBatchDto } from './dto/ingest-batch.dto';

@ApiTags('balances')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('balances')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my balances (triggers background HCM sync)' })
  getMyBalances(@CurrentUser() user: User) {
    return this.balanceService.getBalance(user.id, user.locationId);
  }

  @Get(':employeeId/:locationId')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get balances for a specific employee (manager/admin)' })
  getBalances(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.balanceService.getBalance(employeeId, locationId);
  }

  @Post('sync/batch')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ingest full HCM batch payload (admin only)' })
  ingestBatch(@Body() dto: IngestBatchDto) {
    return this.balanceService.ingestBatch(dto.records);
  }

  @Post('sync/employee/:employeeId/:locationId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force realtime HCM sync for one employee' })
  syncEmployee(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.balanceService.syncEmployee(employeeId, locationId);
  }
}
