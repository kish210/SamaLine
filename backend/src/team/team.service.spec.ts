jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
// AuthService در این تست جایگزین می‌شود؛ بسته‌ی ESM آن نباید بارگذاری شود.
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));

import * as bcrypt from 'bcrypt';
import type { DataSource } from 'typeorm';
import type { JwtUser } from '../common/current-user.decorator';
import { InvitationEntity } from '../database/entities/invitation.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import {
  OrganizationRole,
  OrganizationUserEntity,
} from '../database/entities/organization-user.entity';
import { UserEntity } from '../database/entities/user.entity';
import type { OutboundMessage } from '../messaging/messaging.types';
import { createTestDataSource } from '../testing/test-database';
import { checkRemoval, checkRoleChange, checkSeatLimit } from './team-rules';
import { hashInvitationToken, TeamService } from './team.service';

describe('قواعد تیم', () => {
  const { OWNER, ADMIN, EDITOR, VIEWER } = OrganizationRole;

  it('مدیر نمی‌تواند به مالک دست بزند یا کسی را مالک کند', () => {
    expect(
      checkRoleChange({
        actor: ADMIN,
        current: OWNER,
        next: VIEWER,
        ownerCount: 2,
      }),
    ).toMatch('فقط مالک');
    expect(
      checkRoleChange({
        actor: ADMIN,
        current: EDITOR,
        next: OWNER,
        ownerCount: 1,
      }),
    ).toMatch('فقط مالک');
    expect(
      checkRoleChange({
        actor: ADMIN,
        current: EDITOR,
        next: VIEWER,
        ownerCount: 1,
      }),
    ).toBeNull();
  });

  it('آخرین مالک پایین نمی‌آید، ولی با دو مالک می‌شود', () => {
    expect(
      checkRoleChange({
        actor: OWNER,
        current: OWNER,
        next: ADMIN,
        ownerCount: 1,
      }),
    ).toMatch('دست‌کم یک مالک');
    expect(
      checkRoleChange({
        actor: OWNER,
        current: OWNER,
        next: ADMIN,
        ownerCount: 2,
      }),
    ).toBeNull();
  });

  it('حذف: نه خود، نه مالک به دست مدیر، نه آخرین مالک', () => {
    expect(
      checkRemoval({ actor: OWNER, target: EDITOR, self: true, ownerCount: 1 }),
    ).toMatch('خودتان');
    expect(
      checkRemoval({ actor: ADMIN, target: OWNER, self: false, ownerCount: 2 }),
    ).toMatch('فقط مالک');
    expect(
      checkRemoval({ actor: OWNER, target: OWNER, self: false, ownerCount: 1 }),
    ).toMatch('دست‌کم یک مالک');
    expect(
      checkRemoval({
        actor: ADMIN,
        target: VIEWER,
        self: false,
        ownerCount: 1,
      }),
    ).toBeNull();
  });

  it('سقف کاربران، دعوت‌های در انتظار را هم می‌شمارد؛ منفی یعنی نامحدود', () => {
    expect(checkSeatLimit({ limit: 3, members: 1, pending: 1 })).toBeNull();
    expect(checkSeatLimit({ limit: 3, members: 1, pending: 2 })).toMatch(
      'سقف کاربران',
    );
    expect(checkSeatLimit({ limit: -1, members: 99, pending: 99 })).toBeNull();
  });
});

describe('TeamService — دعوت، پذیرش و مدیریت اعضا', () => {
  let ds: DataSource;
  let service: TeamService;
  let sent: OutboundMessage[];
  let seatLimit: number;
  let organizationId: string;
  let owner: JwtUser;

  const members = () => ds.getRepository(OrganizationUserEntity);
  const users = () => ds.getRepository(UserEntity);
  const tokenFrom = (link: string) => /token=([0-9a-f]{64})/.exec(link)![1];

  const addMember = async (
    email: string,
    role: OrganizationRole,
    password = 'Secret123',
  ) => {
    const user = await users().save({
      fullName: email.split('@')[0],
      email,
      passwordHash: await bcrypt.hash(password, 4),
    });
    const member = await members().save({
      organizationId,
      userId: user.id,
      role,
    });
    return { user, member };
  };

  beforeEach(async () => {
    ds = await createTestDataSource();
    sent = [];
    seatLimit = 5;
    organizationId = (
      await ds.getRepository(OrganizationEntity).save({ name: 'کافه سما' })
    ).id;
    const { user } = await addMember(
      'owner@example.com',
      OrganizationRole.OWNER,
    );
    owner = {
      sub: user.id,
      email: user.email,
      organizationId,
      workspaceId: '',
      role: OrganizationRole.OWNER,
    };

    service = new TeamService(
      members(),
      ds.getRepository(InvitationEntity),
      users(),
      ds.getRepository(OrganizationEntity),
      {
        getPolicyByOrganization: () =>
          Promise.resolve({ workspaceUsers: seatLimit }),
      } as never,
      {
        send: (message: OutboundMessage) => {
          sent.push(message);
          return Promise.resolve({ status: 'sent', providerMessage: null });
        },
      } as never,
      {
        sessionFor: (user: UserEntity, orgId: string) =>
          Promise.resolve({ accessToken: 'token', userId: user.id, orgId }),
      } as never,
      {
        verifyLogin: (_userId: string, code: string) =>
          code === '123456'
            ? Promise.resolve()
            : Promise.reject(new Error('کد نادرست')),
      } as never,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('دعوت: لینک به ایمیل می‌رود و به دعوت‌کننده برمی‌گردد؛ فقط هش ذخیره می‌شود', async () => {
    const result = await service.invite(
      owner,
      { email: 'Ali@Example.com', role: OrganizationRole.EDITOR },
      'https://survey.example.com/',
    );
    expect(result.link).toMatch(
      /^https:\/\/survey\.example\.com\/panel\/accept-invite\?token=[0-9a-f]{64}$/,
    );
    expect(result.email).toBe('ali@example.com');
    expect(sent[0].recipient).toBe('ali@example.com');
    expect(sent[0].body).toContain(result.link);
    expect(sent[0].body).toContain('ویرایشگر');

    const stored = await ds.getRepository(InvitationEntity).find();
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).toBe(
      hashInvitationToken(tokenFrom(result.link)),
    );
    expect(JSON.stringify(stored)).not.toContain(tokenFrom(result.link));
  });

  it('عضو فعلی را دوباره نمی‌شود دعوت کرد', async () => {
    await addMember('sara@example.com', OrganizationRole.VIEWER);
    await expect(
      service.invite(
        owner,
        { email: 'sara@example.com', role: OrganizationRole.EDITOR },
        'http://x',
      ),
    ).rejects.toThrow('از قبل عضو');
  });

  it('دعوت دوباره‌ی یک ایمیل، لینک قبلی را باطل می‌کند', async () => {
    const first = await service.invite(
      owner,
      { email: 'ali@example.com', role: OrganizationRole.EDITOR },
      'http://x',
    );
    await service.invite(
      owner,
      { email: 'ali@example.com', role: OrganizationRole.ANALYST },
      'http://x',
    );
    expect(await service.listInvitations(organizationId)).toHaveLength(1);
    await expect(service.preview(tokenFrom(first.link))).rejects.toThrow(
      'نامعتبر',
    );
  });

  it('سقف کاربران پلن با شمردن دعوت‌های در انتظار اعمال می‌شود', async () => {
    seatLimit = 2;
    await service.invite(
      owner,
      { email: 'a@example.com', role: OrganizationRole.VIEWER },
      'http://x',
    );
    await expect(
      service.invite(
        owner,
        { email: 'b@example.com', role: OrganizationRole.VIEWER },
        'http://x',
      ),
    ).rejects.toThrow('سقف کاربران');
  });

  it('پذیرش با ساخت حساب تازه، عضویت با نقش دعوت می‌سازد و لینک را مصرف می‌کند', async () => {
    const { link } = await service.invite(
      owner,
      { email: 'new@example.com', role: OrganizationRole.ANALYST },
      'http://x',
    );
    const token = tokenFrom(link);

    const preview = await service.preview(token);
    expect(preview).toMatchObject({
      organizationName: 'کافه سما',
      email: 'new@example.com',
      roleLabel: 'تحلیلگر',
      accountExists: false,
    });

    await expect(
      service.accept({ token, password: 'short', fullName: 'نیما' }),
    ).rejects.toThrow('دست‌کم ۸');

    const session = (await service.accept({
      token,
      password: 'NewPass123',
      fullName: 'نیما',
    })) as unknown as { orgId: string; userId: string };
    expect(session.orgId).toBe(organizationId);

    const member = await members().findOneByOrFail({ userId: session.userId });
    expect(member.role).toBe(OrganizationRole.ANALYST);
    const user = await users().findOneByOrFail({ id: session.userId });
    expect(await bcrypt.compare('NewPass123', user.passwordHash)).toBe(true);

    await expect(
      service.accept({ token, password: 'NewPass123' }),
    ).rejects.toThrow('نامعتبر');
  });

  it('حساب موجود فقط با رمز خودش و کد دومرحله‌ای می‌پذیرد', async () => {
    const other = await ds
      .getRepository(OrganizationEntity)
      .save({ name: 'دیگر' });
    const existing = await users().save({
      fullName: 'رضا',
      email: 'reza@example.com',
      passwordHash: await bcrypt.hash('RezaPass1', 4),
      totpEnabled: true,
    });
    await members().save({
      organizationId: other.id,
      userId: existing.id,
      role: OrganizationRole.OWNER,
    });

    const { link } = await service.invite(
      owner,
      { email: 'reza@example.com', role: OrganizationRole.EDITOR },
      'http://x',
    );
    const token = tokenFrom(link);
    expect(await service.preview(token)).toMatchObject({
      accountExists: true,
      twoFactorRequired: true,
    });

    await expect(
      service.accept({ token, password: 'wrong-pass' }),
    ).rejects.toThrow('درست نیست');
    expect(await service.accept({ token, password: 'RezaPass1' })).toEqual({
      twoFactorRequired: true,
    });
    await expect(
      service.accept({ token, password: 'RezaPass1', totpCode: '000000' }),
    ).rejects.toThrow('کد نادرست');

    await service.accept({ token, password: 'RezaPass1', totpCode: '123456' });
    const memberships = await members().findBy({ userId: existing.id });
    expect(memberships.map((m) => m.role).sort()).toEqual(['editor', 'owner']);
  });

  it('پلنی که پس از دعوت پایین آمده، پذیرش را رد می‌کند', async () => {
    const { link } = await service.invite(
      owner,
      { email: 'late@example.com', role: OrganizationRole.VIEWER },
      'http://x',
    );
    seatLimit = 1;
    await expect(
      service.accept({
        token: tokenFrom(link),
        password: 'LatePass1',
        fullName: 'دیرکرد',
      }),
    ).rejects.toThrow('سقف کاربران');
  });

  it('لینک منقضی پذیرفته نمی‌شود', async () => {
    const { link, id } = await service.invite(
      owner,
      { email: 'old@example.com', role: OrganizationRole.VIEWER },
      'http://x',
    );
    await ds
      .getRepository(InvitationEntity)
      .update(id, { expiresAt: new Date(Date.now() - 1000) });
    await expect(service.preview(tokenFrom(link))).rejects.toThrow('منقضی');
  });

  it('تغییر نقش و حذف عضو، با رعایت قواعد مالک', async () => {
    const { member: editor } = await addMember(
      'editor@example.com',
      OrganizationRole.EDITOR,
    );
    const { user: adminUser } = await addMember(
      'admin@example.com',
      OrganizationRole.ADMIN,
    );
    const admin: JwtUser = {
      ...owner,
      sub: adminUser.id,
      role: OrganizationRole.ADMIN,
    };
    const ownerMember = await members().findOneByOrFail({ userId: owner.sub });

    await service.changeRole(admin, editor.id, OrganizationRole.VIEWER);
    expect((await members().findOneByOrFail({ id: editor.id })).role).toBe(
      'viewer',
    );

    await expect(service.removeMember(admin, ownerMember.id)).rejects.toThrow(
      'فقط مالک',
    );
    await expect(
      service.changeRole(owner, ownerMember.id, OrganizationRole.ADMIN),
    ).rejects.toThrow('دست‌کم یک مالک');

    await service.removeMember(admin, editor.id);
    expect(await members().findOneBy({ id: editor.id })).toBeNull();
  });

  it('عضو سازمان دیگر از این سازمان قابل تغییر نیست', async () => {
    const other = await ds
      .getRepository(OrganizationEntity)
      .save({ name: 'دیگر' });
    const outsider = await members().save({
      organizationId: other.id,
      userId: owner.sub,
      role: OrganizationRole.VIEWER,
    });
    await expect(
      service.changeRole(owner, outsider.id, OrganizationRole.ADMIN),
    ).rejects.toThrow('یافت نشد');
    await expect(service.removeMember(owner, outsider.id)).rejects.toThrow(
      'یافت نشد',
    );
  });
});
