import { backupsToPrune, dailyBackupName } from './daily-backup.service';

describe('پشتیبان روزانه', () => {
  it('نام فایل تاریخ روز را دارد', () => {
    expect(dailyBackupName(new Date('2026-09-29T10:00:00Z'))).toBe(
      'samaline-2026-09-29.sqlite',
    );
  });

  it('فقط تازه‌ترین‌ها می‌مانند', () => {
    const names = [
      'samaline-2026-09-27.sqlite',
      'samaline-2026-09-29.sqlite',
      'samaline-2026-09-28.sqlite',
      'samaline-2026-09-26.sqlite',
    ];
    expect(backupsToPrune(names, 2).sort()).toEqual([
      'samaline-2026-09-26.sqlite',
      'samaline-2026-09-27.sqlite',
    ]);
  });

  it('فایل‌های دیگر پوشه هرگز پاک نمی‌شوند', () => {
    const names = [
      'notes.txt',
      'samaline.sqlite',
      'samaline-2026-09-01.sqlite',
    ];
    expect(backupsToPrune(names, 0)).toEqual(['samaline-2026-09-01.sqlite']);
  });

  it('تعداد کمتر از سقف چیزی را پاک نمی‌کند', () => {
    expect(backupsToPrune(['samaline-2026-09-01.sqlite'], 14)).toEqual([]);
  });
});
