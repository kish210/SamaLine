import { assertPublicUrl, isPrivateAddress } from './url-guard';

describe('isPrivateAddress', () => {
  it('بازه‌های خصوصی IPv4 را تشخیص می‌دهد', () => {
    for (const ip of [
      '10.0.0.1',
      '127.0.0.1',
      '172.16.5.4',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254', // متادیتای ابری
      '100.64.0.1',
      '0.0.0.0',
    ]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
  });

  it('نشانی عمومی را خصوصی نمی‌داند', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '192.169.1.1']) {
      expect(isPrivateAddress(ip)).toBe(false);
    }
  });

  it('بازه‌های خصوصی IPv6 را تشخیص می‌دهد', () => {
    for (const ip of ['::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
  });

  it('IPv6 عمومی را خصوصی نمی‌داند', () => {
    expect(isPrivateAddress('2001:4860:4860::8888')).toBe(false);
  });
});

describe('assertPublicUrl', () => {
  const originalEnv = process.env.ALLOW_PRIVATE_CONTACT_SOURCES;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ALLOW_PRIVATE_CONTACT_SOURCES;
    } else {
      process.env.ALLOW_PRIVATE_CONTACT_SOURCES = originalEnv;
    }
  });

  it('نشانی نامعتبر را رد می‌کند', async () => {
    await expect(assertPublicUrl('نه یک نشانی')).resolves.toMatchObject({
      allowed: false,
    });
  });

  it('پروتکل غیر HTTP را رد می‌کند', async () => {
    const result = await assertPublicUrl('file:///etc/passwd');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('پروتکل');
  });

  it('لوکال‌هاست را رد می‌کند', async () => {
    await expect(
      assertPublicUrl('http://localhost:3000/users'),
    ).resolves.toMatchObject({ allowed: false });
  });

  it('نشانی IP شبکه داخلی را رد می‌کند', async () => {
    for (const url of [
      'http://127.0.0.1/x',
      'http://10.0.0.5/api',
      'http://192.168.1.10/api',
      'http://169.254.169.254/latest/meta-data',
    ]) {
      const result = await assertPublicUrl(url);
      expect(result.allowed).toBe(false);
    }
  });

  it('دامنه‌ی .local را رد می‌کند', async () => {
    await expect(
      assertPublicUrl('http://crm.local/api/users'),
    ).resolves.toMatchObject({ allowed: false });
  });

  it('نشانی IP عمومی را می‌پذیرد', async () => {
    await expect(assertPublicUrl('https://8.8.8.8/api')).resolves.toEqual({
      allowed: true,
      reason: null,
    });
  });

  it('با اجازه‌ی صریح، نشانی داخلی مجاز می‌شود', async () => {
    process.env.ALLOW_PRIVATE_CONTACT_SOURCES = 'true';
    await expect(
      assertPublicUrl('http://192.168.1.10/api'),
    ).resolves.toMatchObject({ allowed: true });
  });
});
