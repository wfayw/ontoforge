import { useAuthStore } from '@/stores/authStore';

const ROLE_ADMIN = 'admin';
const ROLE_EDITOR = 'editor';

export function usePermission() {
  const { user } = useAuthStore();
  const role = user?.role || 'viewer';

  const isAdmin = role === ROLE_ADMIN;
  const isEditor = role === ROLE_ADMIN || role === ROLE_EDITOR;
  const canWrite = isEditor;
  const canManageUsers = isAdmin;
  const canViewAudit = isAdmin;

  return { role, isAdmin, isEditor, canWrite, canManageUsers, canViewAudit };
}
