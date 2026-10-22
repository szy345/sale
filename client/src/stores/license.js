import { reactive } from 'vue';
import api from '../api';

export const license = reactive({
  status: null,
  checked: false,
  loading: false,
});

export function licenseAllowed() {
  return license.status?.allowed !== false;
}

export async function loadLicenseStatus(force = false) {
  if (license.loading) return license.status;
  if (license.checked && !force) return license.status;

  license.loading = true;
  try {
    const { data } = await api.get('/license/status');
    license.status = data;
  } catch {
    license.status = {
      allowed: true,
      status: 'unknown',
      message: '暂时无法获取授权状态',
    };
  } finally {
    license.checked = true;
    license.loading = false;
  }
  return license.status;
}

export async function importLicense(contentBase64) {
  const { data } = await api.post('/license/import', {
    content_base64: contentBase64,
  });
  license.status = data;
  license.checked = true;
  return data;
}

export function clearLicenseStatus() {
  license.status = null;
  license.checked = false;
  license.loading = false;
}
