import { reactive } from 'vue';
import api from '../api';

export const settings = reactive({
  systemName: '销售维保系统',
  version: '1.0.0',
  loaded: false,
});

export function appTitle() {
  return `${settings.systemName}销售维保系统`;
}

export async function loadPublicSettings() {
  try {
    const { data } = await api.get('/settings/public');
    if (data.systemName) settings.systemName = data.systemName;
    if (data.version) settings.version = data.version;
  } catch {
    // Keep the default name if the settings endpoint is unavailable.
  } finally {
    settings.loaded = true;
  }
  return settings.systemName;
}

export async function saveSystemName(name) {
  const { data } = await api.patch('/settings', { system_name: name });
  if (data.systemName) settings.systemName = data.systemName;
  return settings.systemName;
}
