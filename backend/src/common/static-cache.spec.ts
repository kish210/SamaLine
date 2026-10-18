import { cacheControlFor } from './static-cache';

describe('سیاست کش فایل‌های ساخته‌شده', () => {
  it('فایل هش‌دار assets یک سال و immutable', () => {
    expect(
      cacheControlFor('/opt/samaline/panel/dist/assets/index-BFSOXR8S.js'),
    ).toBe('public, max-age=31536000, immutable');
    expect(cacheControlFor('C:\\app\\form-renderer\\dist\\assets\\a.css')).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  it('index.html، سرویس‌ورکر و manifest همیشه تازه', () => {
    for (const file of [
      '/opt/samaline/panel/dist/index.html',
      '/opt/samaline/form-renderer/dist/service-worker.js',
      '/opt/samaline/form-renderer/dist/manifest.webmanifest',
    ]) {
      expect(cacheControlFor(file)).toBe('no-cache');
    }
  });
});
