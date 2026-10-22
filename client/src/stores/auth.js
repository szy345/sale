import { reactive } from 'vue';
import api from '../api';

export const auth = reactive({
  user: null,
  checked: false,
  needsSetup: false,
});

let setupRequest = null;

export async function refreshSetupStatus() {
  if (!setupRequest) {
    setupRequest = api
      .get('/setup/status')
      .then(({ data }) => {
        auth.needsSetup = Boolean(data.needsSetup);
        return auth.needsSetup;
      })
      .finally(() => {
        setupRequest = null;
      });
  }
  return setupRequest;
}

export async function loadMe() {
  try {
    const { data } = await api.get('/auth/me');
    auth.user = data.user;
  } catch {
    auth.user = null;
  }
  return auth.user;
}

export async function bootstrap() {
  try {
    await refreshSetupStatus();
    if (!auth.needsSetup) await loadMe();
  } finally {
    auth.checked = true;
  }
}

export async function login(credentials) {
  const { data } = await api.post('/auth/login', credentials);
  auth.user = data.user;
  auth.needsSetup = false;
  auth.checked = true;
  return data.user;
}

export async function setupAdmin(payload) {
  const { data } = await api.post('/setup', payload);
  auth.user = data.user;
  auth.needsSetup = false;
  auth.checked = true;
  return data.user;
}

export async function changePassword(payload) {
  const { data } = await api.post('/auth/change-password', payload);
  auth.user = data.user;
  return data.user;
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } finally {
    auth.user = null;
  }
}

export function setUser(user) {
  auth.user = user;
}
