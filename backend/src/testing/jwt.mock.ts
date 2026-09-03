import * as jsonwebtoken from 'jsonwebtoken';

/**
 * جایگزین سبک JwtService برای تست‌ها.
 *
 * `@nestjs/jwt` خالص ESM است و Jest در حالت CommonJS نمی‌تواند لودش کند؛
 * این کلاس همان قرارداد امضا/بررسی را با jsonwebtoken می‌سازد.
 */
export class FakeJwtService {
  constructor(private readonly options: { secret: string }) {}

  sign(payload: object, opts?: jsonwebtoken.SignOptions): string {
    return jsonwebtoken.sign(payload, this.options.secret, opts);
  }

  verify<T>(token: string): T {
    return jsonwebtoken.verify(token, this.options.secret) as T;
  }
}

/** ماژول ماک‌شده‌ی @nestjs/jwt برای jest.mock. */
export function nestJwtModuleMock() {
  return {
    JwtService: FakeJwtService,
    JwtModule: { register: () => ({}), registerAsync: () => ({}) },
  };
}
