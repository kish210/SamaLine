import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { PlanService } from './plan.service';

@Controller('plans')
@UseGuards(JwtAuthGuard)
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Get('policy/:organizationId')
  getPolicy(@Param('organizationId') organizationId: string) {
    return this.planService.getPolicyByOrganization(organizationId);
  }
}
