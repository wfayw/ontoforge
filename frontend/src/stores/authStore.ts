import { create } from 'zustand';
import { authApi } from '@/services/api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  loading: false,

  login: async (username, password) => {
    const { data } = await authApi.login({ username, password });
    localStorage.setItem('token', data.access_token);
    set({ token: data.access_token });
    const me = await authApi.me();
    set({ user: me.data });
  },

  register: async (username, email, password) => {
    await authApi.register({ username, email, password });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  fetchUser: async () => {
    try {
      set({ loading: true });
      const { data } = await authApi.me();
      set({ user: data });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null });
    } finally {
      set({ loading: false });
    }
  },
}));
