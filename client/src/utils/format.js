import dayjs from 'dayjs';

export function today() {
  return dayjs().format('YYYY-MM-DD');
}

export function formatDateTime(value) {
  if (!value) return '-';
  return dayjs(value).format('YYYY-MM-DD HH:mm');
}

export function formatDate(value) {
  if (!value) return '-';
  return dayjs(value).format('YYYY-MM-DD');
}

export function centsToYuan(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

export function yuanToCents(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100);
}

export function productSummary(item) {
  if (!item) return '—';
  const parts = [item.product_name, item.item_no, item.color, item.size].filter(Boolean);
  return parts.length ? parts.join(' / ') : '—';
}

export function roleLabel(role) {
  return role === 'admin' ? '管理员' : '操作员';
}
