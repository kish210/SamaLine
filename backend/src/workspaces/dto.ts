import { IsNotEmpty } from 'class-validator';

export class CreateWorkspaceDto {
  @IsNotEmpty()
  organizationId: string;

  @IsNotEmpty()
  name: string;
}
