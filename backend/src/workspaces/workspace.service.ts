import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { CreateWorkspaceDto } from './dto';

@Injectable()
export class WorkspaceService {
  constructor(@InjectRepository(WorkspaceEntity) private readonly workspaceRepo: Repository<WorkspaceEntity>) {}

  list(organizationId: string) {
    return this.workspaceRepo.find({ where: { organizationId }, order: { createdAt: 'DESC' } });
  }

  create(dto: CreateWorkspaceDto) {
    return this.workspaceRepo.save(this.workspaceRepo.create(dto));
  }
}
