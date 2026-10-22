export const REPAIR_STATUSES = [
  'pending_factory',
  'sent_factory',
  'factory_returned',
  'customer_notified',
  'customer_picked',
];

export const REPAIR_STATUS_LABELS = {
  pending_factory: '待返厂维修',
  sent_factory: '已返厂维修',
  factory_returned: '厂家已寄回',
  customer_notified: '已通知客户',
  customer_picked: '客户已取走',
};

export const REPAIR_STAGES = [
  'sent_factory',
  'factory_returned',
  'customer_notified',
  'customer_picked',
];

export const NEXT_STAGE = {
  pending_factory: 'sent_factory',
  sent_factory: 'factory_returned',
  factory_returned: 'customer_notified',
  customer_notified: 'customer_picked',
};

export const REWORK_ALLOWED_STATUSES = ['factory_returned', 'customer_picked'];

export const STAGE_ACTION_LABELS = {
  sent_factory: '登记已返厂维修',
  factory_returned: '登记厂家已寄回',
  customer_notified: '登记已通知客户',
  customer_picked: '登记客户已取走',
};

export const HANDLING_OPTIONS = [
  { value: 'refund', label: '退款' },
  { value: 'exchange', label: '换货' },
  { value: 'repair', label: '维修' },
  { value: 'other', label: '其他' },
];

export const RETURN_REASON_OPTIONS = [
  '质量问题',
  '尺码不合适',
  '颜色/款式不喜欢',
  '发错货',
  '其他',
];
