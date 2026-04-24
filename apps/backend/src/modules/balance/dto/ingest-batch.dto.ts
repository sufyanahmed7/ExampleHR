import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsString, Min, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BatchRecordDto {
  @ApiProperty() @IsString() employeeId: string;
  @ApiProperty() @IsString() locationId: string;
  @ApiProperty() @IsString() leaveType: string;
  @ApiProperty() @IsNumber() @Min(0) totalDays: number;
  @ApiProperty() @IsNumber() @Min(0) usedDays: number;
}

export class IngestBatchDto {
  @ApiProperty({ type: [BatchRecordDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchRecordDto)
  records: BatchRecordDto[];
}
