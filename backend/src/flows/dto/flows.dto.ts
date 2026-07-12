import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaveFlowTriggerDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  configuration?: any;
}

export class SaveFlowBranchDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsOptional()
  condition?: any;

  @IsString()
  @IsOptional()
  nextStepId?: string;
}

export class SaveFlowStepDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  configuration?: any;

  @IsOptional()
  metadata?: any;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SaveFlowBranchDto)
  branches?: SaveFlowBranchDto[];
}

export class SaveFlowDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SaveFlowTriggerDto)
  triggers?: SaveFlowTriggerDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SaveFlowStepDto)
  steps?: SaveFlowStepDto[];
}
