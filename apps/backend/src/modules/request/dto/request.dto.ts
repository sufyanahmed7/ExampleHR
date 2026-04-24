import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '../../../database/entities/time-off-request.entity';

export class CreateRequestDto {
  @ApiProperty({ example: 'ANNUAL' })
  @IsString()
  leaveType: string;

  @ApiProperty({ example: '2025-07-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2025-07-05' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0.5)
  @Max(365)
  daysRequested: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectRequestDto {
  @ApiProperty()
  @IsString()
  reason: string;
}

export class ListRequestsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ enum: RequestStatus })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
