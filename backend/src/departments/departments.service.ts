import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DepartmentEntity } from '../database/entities/department.entity';
import { DepartmentMemberEntity } from '../database/entities/department-member.entity';
import { OrganizationUserEntity } from '../database/entities/organization-user.entity';
import { UserEntity } from '../database/entities/user.entity';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import type { JwtUser } from '../common/current-user.decorator';

export interface DepartmentInput {
  name?: string;
  key?: string;
}

/**
 * بخش‌های سازمانی (فنی، خانه‌داری، HR، IT، پیمانکاران …) و عضویتِ کاربران.
 *
 * دسترسیِ فرم‌های عملیاتی بر پایه‌ی عضویت در بخش سنجیده می‌شود (فاز A). بخش‌ها
 * سطحِ سازمان‌اند؛ مالکیت با `user.organizationId` بررسی می‌شود.
 */
@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(DepartmentEntity)
    private readonly departments: Repository<DepartmentEntity>,
    @InjectRepository(DepartmentMemberEntity)
    private readonly members: Repository<DepartmentMemberEntity>,
    @InjectRepository(OrganizationUserEntity)
    private readonly orgUsers: Repository<OrganizationUserEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  // ── بخش‌ها ────────────────────────────────────────────────────────────────

  async list(organizationId: string) {
    const rows = await this.departments.find({
      where: { organizationId },
      order: { name: 'ASC' },
    });
    const counts = new Map<string, number>();
    if (rows.length > 0) {
      const raw = await this.members
        .createQueryBuilder('m')
        .select('m.departmentId', 'departmentId')
        .addSelect('COUNT(*)', 'count')
        .where('m.departmentId IN (:...ids)', { ids: rows.map((r) => r.id) })
        .groupBy('m.departmentId')
        .getRawMany<{ departmentId: string; count: string }>();
      for (const r of raw) counts.set(r.departmentId, Number(r.count));
    }
    return rows.map((r) => ({ ...r, memberCount: counts.get(r.id) ?? 0 }));
  }

  async create(organizationId: string, input: DepartmentInput) {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('نام بخش لازم است');
    return this.departments.save(
      this.departments.create({
        organizationId,
        name: name.slice(0, 120),
        key: (input.key ?? '').slice(0, 40),
      }),
    );
  }

  async rename(organizationId: string, id: string, input: DepartmentInput) {
    const dept = await this.assertDept(organizationId, id);
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new BadRequestException('نام بخش لازم است');
      dept.name = name.slice(0, 120);
    }
    if (input.key !== undefined) dept.key = input.key.slice(0, 40);
    return this.departments.save(dept);
  }

  async remove(organizationId: string, id: string) {
    await this.assertDept(organizationId, id);
    await this.members.delete({ departmentId: id });
    await this.departments.delete({ id });
    return { ok: true };
  }

  // ── عضویت ────────────────────────────────────────────────────────────────

  async listMembers(organizationId: string, departmentId: string) {
    await this.assertDept(organizationId, departmentId);
    const rows = await this.members.find({ where: { departmentId } });
    if (rows.length === 0) return [];
    const users = await this.users.find({
      where: { id: In(rows.map((r) => r.userId)) },
      select: { id: true, email: true, fullName: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      email: byId.get(r.userId)?.email ?? '',
      fullName: byId.get(r.userId)?.fullName ?? '',
    }));
  }

  /** افزودن عضو؛ کاربر باید عضوِ همین سازمان باشد. */
  async addMember(organizationId: string, departmentId: string, userId: string) {
    await this.assertDept(organizationId, departmentId);
    const inOrg = await this.orgUsers.findOne({ where: { organizationId, userId } });
    if (!inOrg) throw new BadRequestException('این کاربر عضو سازمان نیست');
    const already = await this.members.findOne({ where: { departmentId, userId } });
    if (already) return already;
    return this.members.save(this.members.create({ departmentId, userId }));
  }

  async removeMember(organizationId: string, departmentId: string, userId: string) {
    await this.assertDept(organizationId, departmentId);
    await this.members.delete({ departmentId, userId });
    return { ok: true };
  }

  // ── برای دسترسیِ فرم ────────────────────────────────────────────────────

  /** شناسه‌ی بخش‌هایی که این کاربر عضوشان است. */
  async memberDepartmentIds(userId: string): Promise<string[]> {
    const rows = await this.members.find({
      where: { userId },
      select: { departmentId: true },
    });
    return rows.map((r) => r.departmentId);
  }

  /** بخش‌های همین کاربر (برای نمایش «بخش‌های من»). */
  async myDepartments(user: JwtUser) {
    const ids = await this.memberDepartmentIds(user.sub);
    if (ids.length === 0) return [];
    return this.departments.find({
      where: { id: In(ids), organizationId: user.organizationId },
      order: { name: 'ASC' },
    });
  }

  async isMember(userId: string, departmentId: string): Promise<boolean> {
    const row = await this.members.findOne({ where: { userId, departmentId } });
    return Boolean(row);
  }

  /** مدیر/مالک به همه‌ی بخش‌ها دسترسی دارد؛ بقیه فقط بخش‌های خودشان. */
  isManager(user: JwtUser): boolean {
    return (
      user.role === OrganizationRole.OWNER || user.role === OrganizationRole.ADMIN
    );
  }

  private async assertDept(organizationId: string, id: string) {
    const dept = await this.departments.findOne({ where: { id, organizationId } });
    if (!dept) throw new NotFoundException('بخش یافت نشد');
    return dept;
  }
}
