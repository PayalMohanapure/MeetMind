import { api } from '@/lib/api';
import { AUTH } from './endpoints';
import { normTokens, normUser } from './normalize';
import { ApiError } from '@/lib/errors';
import { session } from '@/lib/session';

export async function login(identifier, password) {
  const r = AUTH.loginFormat === 'form'
    ? await api.raw('POST', AUTH.login, { form: { username: identifier, password }, skipAuth: true, noRetry: true })
    : await api.post(AUTH.login, { email_or_username: identifier, username: identifier, password }, { skipAuth: true, noRetry: true });
  return normTokens(r);
}
export const register = async (data) => normUser(await api.post(AUTH.register, data, { skipAuth: true, noRetry: true }));
export const demoLogin = async () => {
  if (!AUTH.demo) throw new ApiError(404, 'The demo account is not available on this server.');
  return normTokens(await api.post(AUTH.demo, {}, { skipAuth: true, noRetry: true }));
};
export const me = async () => normUser(await api.get(AUTH.me));
export const logout = () => api.post(AUTH.logout, { refresh_token: session.refreshToken || undefined }).catch(() => null);
export const updateMe = async (data) => {
  if (!AUTH.updateMe) throw new ApiError(404, 'Editing your profile is not available on this server yet.');
  return normUser(await api.patch(AUTH.updateMe, data));
};
export const changePassword = (data) => {
  if (!AUTH.changePassword) throw new ApiError(404, 'Changing your password is not available on this server yet.');
  return api.post(AUTH.changePassword, data);
};
