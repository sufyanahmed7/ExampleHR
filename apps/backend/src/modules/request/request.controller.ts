import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequestService } from './request.service';
import { CreateRequestDto, RejectRequestDto, ListRequestsDto } from './dto/request.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';

@ApiTags('requests')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('requests')
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  @Post()
  @ApiOperation({ summary: 'Employee submits a time-off request' })
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: User) {
    return this.requestService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List requests (scoped by role)' })
  list(@Query() query: ListRequestsDto, @CurrentUser() user: User) {
    return this.requestService.list(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single request' })
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.requestService.findOne(id, user);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Manager approves a request' })
  approve(@Param('id') id: string, @CurrentUser() user: User) {
    return this.requestService.approve(id, user);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Manager rejects a request' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectRequestDto,
    @CurrentUser() user: User,
  ) {
    return this.requestService.reject(id, dto.reason, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Employee cancels a PENDING request' })
  cancel(@Param('id') id: string, @CurrentUser() user: User) {
    return this.requestService.cancel(id, user);
  }
}
