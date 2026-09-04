import { useState } from 'react';
import { formUrl } from '../../renderer-url';

interface Props {
  /** توکن انتشار؛ بدون آن فرم هنوز آدرس عمومی ندارد. */
  token?: string;
  /** آیا از آخرین ذخیره تغییر ذخیره‌نشده‌ای هست؟ */
  dirty: boolean;
  /** شمارنده‌ای که با هر ذخیره عوض می‌شود تا iframe تازه شود. */
  version: number;
}

type Device = 'mobile' | 'desktop';



/**
 * پیش‌نمایش زنده‌ی فرم، کنار ویرایشگر.
 *
 * عمداً خودِ رندرر واقعی در iframe نشان داده می‌شود، نه یک بازسازی جداگانه
 * در پنل؛ هر بازسازی جدا با گذشت زمان از رندرر واقعی واگرا می‌شود و آن‌وقت
 * پیش‌نمایش دروغ می‌گوید.
 */
export function LivePreview({ token, dirty, version }: Props) {
  const [device, setDevice] = useState<Device>('mobile');

  if (!token) {
    return (
      <aside className="live-preview">
        <p className="hint">
          برای دیدن پیش‌نمایش، ابتدا فرم را منتشر کنید تا نشانی عمومی بگیرد.
        </p>
      </aside>
    );
  }

  return (
    <aside className={`live-preview ${device}`}>
      <div className="preview-head">
        <span>پیش‌نمایش زنده</span>
        <div className="device-switch">
          <button
            type="button"
            className={device === 'mobile' ? 'active' : ''}
            onClick={() => setDevice('mobile')}
          >
            موبایل
          </button>
          <button
            type="button"
            className={device === 'desktop' ? 'active' : ''}
            onClick={() => setDevice('desktop')}
          >
            دسکتاپ
          </button>
        </div>
      </div>

      {dirty && (
        <p className="preview-note">
          پیش‌نمایش آخرین نسخه‌ی <strong>ذخیره‌شده</strong> را نشان می‌دهد؛
          برای دیدن تغییرات جاری، فرم را ذخیره کنید.
        </p>
      )}

      <div className="preview-frame">
        <iframe
          // با هر ذخیره، key عوض می‌شود و iframe از نو بارگذاری می‌شود.
          key={version}
          title="پیش‌نمایش فرم"
          src={formUrl(token)}
        />
      </div>
    </aside>
  );
}
