import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const code = error.response?.data?.code;

    if (status === 401 && !url.includes('/auth/login') && !url.includes('/auth/me')) {
      window.dispatchEvent(new Event('auth-expired'));
    }
    if (status === 403 && code === 'PASSWORD_CHANGE_REQUIRED') {
      window.dispatchEvent(new Event('password-change-required'));
    }
    if (status === 403 && code === 'LICENSE_REQUIRED') {
      window.dispatchEvent(new Event('license-required'));
    }
    return Promise.reject(error);
  },
);

export function errorMessage(error) {
  const data = error?.response?.data;
  if (data?.details?.length) {
    return data.details.map((item) => item.message).join('；');
  }
  return data?.message || error?.message || '请求失败，请稍后重试';
}

export default api;
