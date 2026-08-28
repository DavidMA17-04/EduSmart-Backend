import { PartialType } from '@nestjs/swagger';
import { CreateGuideTeacherDto } from './create-guide-teacher.dto';

export class UpdateGuideTeacherDto extends PartialType(CreateGuideTeacherDto) {}
