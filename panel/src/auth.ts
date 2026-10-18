import { create } from 'zustand';
import { setAuthToken } from './api';
import type { AuthPayload, AuthUser } from './types';

const STORAGE_KEY = 'samaline.auth';

interface StoredAuth {
  token: string;
  user: AuthUser;
}

function readStored(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    // حالت خصوصی مرورگر یا داده‌ی خراب: بدون نشست ادامه می‌دهیم.
    return null;
  }
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  signIn: (payload: AuthPayload) => void;
  /** تازه‌سازی اطلاعات حساب (مثل نقش) بدون عوض کردن توکن. */
  updateUser: (patch: Partial<AuthUser>) => void;
  signOut: () => void;
}

const stored = readStored();
// توکن ذخیره‌شده باید پیش از اولین درخواست روی کلاینت بنشیند.
if (stored) setAuthToken(stored.token);

export const useAuth = create<AuthState>((set) => ({
  token: stored?.token ?? null,
  user: stored?.user ?? null,

  signIn: (payload) => {
    setAuthToken(payload.accessToken);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ token: payload.accessToken, user: payload.user }),
      );
    } catch {
      // ذخیره‌نشدن نشست نباید ورود را ناموفق کند.
    }
    set({ token: payload.accessToken, user: payload.user });
  },

  /*
   * نقش کاربر در نشست ذخیره‌شده‌ی قدیمی نیست و می‌تواند هر لحظه عوض شده باشد؛
   * پنل آن را از `/auth/me` می‌گیرد و همین‌جا به‌روز می‌کند.
   */
  updateUser: (patch) =>
    set((state) => {
      if (!state.user) return state;
      const user = { ...state.user, ...patch };
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ token: state.token, user }),
        );
      } catch {
        // بی‌اهمیت؛ فقط در همین نشست می‌ماند.
      }
      return { user };
    }),

  signOut: () => {
    setAuthToken(undefined);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // بی‌اهمیت
    }
    set({ token: null, user: null });
  },
}));
