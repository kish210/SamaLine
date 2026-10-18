import { createServer, type Server, type Socket } from 'node:net';
import type { AddressInfo } from 'node:net';
import { SmtpProvider, smtpConfigFromEnv, toHtml } from './smtp.provider';

/**
 * سرور SMTP آزمایشی کوچک.
 *
 * تا ارسال واقعی nodemailer از اول تا آخر (دست‌دهی، گیرنده، بدنه) سنجیده
 * شود، نه یک ماک که هرچه بگوییم را قبول کند.
 */
function fakeSmtp(options: { rejectRecipient?: boolean } = {}) {
  const messages: Array<{ from: string; to: string[]; data: string }> = [];
  const server: Server = createServer((socket: Socket) => {
    let current = { from: '', to: [] as string[], data: '' };
    let inData = false;
    let buffer = '';
    socket.write('220 test.local ESMTP\r\n');
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let index: number;
      while ((index = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            messages.push(current);
            current = { from: '', to: [], data: '' };
            socket.write('250 OK queued as 42\r\n');
          } else {
            current.data += `${line}\n`;
          }
          continue;
        }
        const command = line.slice(0, 4).toUpperCase();
        if (command === 'EHLO' || command === 'HELO') {
          socket.write('250 test.local\r\n');
        } else if (command === 'MAIL') {
          current.from = line;
          socket.write('250 OK\r\n');
        } else if (command === 'RCPT') {
          if (options.rejectRecipient) {
            socket.write('550 No such user\r\n');
          } else {
            current.to.push(line);
            socket.write('250 OK\r\n');
          }
        } else if (command === 'DATA') {
          inData = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (command === 'QUIT') {
          socket.end('221 Bye\r\n');
        } else {
          socket.write('250 OK\r\n');
        }
      }
    });
  });
  return { server, messages };
}

describe('SmtpProvider', () => {
  let server: Server;
  let messages: ReturnType<typeof fakeSmtp>['messages'];
  let port: number;
  let sender: SmtpProvider | null = null;

  const start = async (options?: { rejectRecipient?: boolean }) => {
    const fake = fakeSmtp(options);
    server = fake.server;
    messages = fake.messages;
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    port = (server.address() as AddressInfo).port;
  };

  afterEach(async () => {
    sender?.close();
    sender = null;
    await new Promise((resolve) => server.close(resolve));
  });

  const provider = () => {
    sender = new SmtpProvider({
      host: '127.0.0.1',
      port,
      secure: false,
      from: 'SamaLine <no-reply@example.com>',
    });
    return sender;
  };

  it('ایمیل را با موضوع و متن فارسی تحویل سرور SMTP می‌دهد', async () => {
    await start();
    const result = await provider().send({
      channel: 'email',
      recipient: 'guest@example.com',
      subject: 'بازیابی رمز',
      body: 'سلام\nلینک: https://survey.example.com/panel/reset?t=abc',
    });

    expect(result.status).toBe('sent');
    expect(messages).toHaveLength(1);
    expect(messages[0].to[0]).toContain('guest@example.com');
    expect(messages[0].from).toContain('no-reply@example.com');
    // موضوع فارسی به‌صورت کدگذاری‌شده‌ی استاندارد می‌رود.
    expect(messages[0].data).toMatch(/Subject: =\?UTF-8\?/i);
  });

  it('گیرنده‌ی ردشده «ناموفق» ثبت می‌شود', async () => {
    await start({ rejectRecipient: true });
    const result = await provider().send({
      channel: 'email',
      recipient: 'nobody@example.com',
      body: 'x',
    });
    expect(result.status).toBe('failed');
  });

  it('سرور در دسترس نبودن خطا پرتاب نمی‌کند، «ناموفق» برمی‌گرداند', async () => {
    await start();
    sender = new SmtpProvider({
      host: '127.0.0.1',
      port: 1, // بسته
      secure: false,
      from: 'a@b.c',
    });
    const result = await sender.send({
      channel: 'email',
      recipient: 'a@b.c',
      body: 'x',
    });
    expect(result.status).toBe('failed');
  });
});

describe('تنظیمات SMTP', () => {
  it('بدون SMTP_HOST فعال نمی‌شود', () => {
    expect(smtpConfigFromEnv({})).toBeNull();
  });

  it('درگاه ۴۶۵ خودکار TLS مستقیم است و فرستنده‌ی پیش‌فرض نام کاربری است', () => {
    expect(
      smtpConfigFromEnv({
        SMTP_HOST: 'mail.example.com',
        SMTP_PORT: '465',
        SMTP_USER: 'bot@example.com',
        SMTP_PASS: 'x',
      }),
    ).toEqual({
      host: 'mail.example.com',
      port: 465,
      secure: true,
      user: 'bot@example.com',
      pass: 'x',
      from: 'bot@example.com',
    });
  });

  it('درگاه ۵۸۷ پیش‌فرض است و STARTTLS دارد نه TLS مستقیم', () => {
    const config = smtpConfigFromEnv({ SMTP_HOST: 'mail.example.com' });
    expect(config?.port).toBe(587);
    expect(config?.secure).toBe(false);
  });
});

describe('نسخه‌ی HTML ایمیل', () => {
  it('راست‌به‌چپ است، HTML را خنثی می‌کند و نشانی را لینک می‌کند', () => {
    const html = toHtml('<b>سلام</b>\nhttps://x.example/a?b=1');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('<a href="https://x.example/a?b=1"');
    expect(html).toContain('<br>');
  });
});
