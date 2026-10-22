export const REPAIR_STATUS_OPTIONS = [
  { value: 'pending_factory', label: '待返厂维修', type: 'danger' },
  { value: 'sent_factory', label: '已返厂维修', type: 'warning' },
  { value: 'factory_returned', label: '厂家已寄回', type: 'info' },
  { value: 'customer_notified', label: '已通知客户', type: 'primary' },
  { value: 'customer_picked', label: '客户已取走', type: 'success' },
];

export const REPAIR_STATUS_LABELS = Object.fromEntries(
  REPAIR_STATUS_OPTIONS.map((item) => [item.value, item.label]),
);

export const REPAIR_STATUS_TYPES = Object.fromEntries(
  REPAIR_STATUS_OPTIONS.map((item) => [item.value, item.type]),
);

export const REPAIR_STATUS_COLORS = {
  pending_factory: '#e6a23c',
  sent_factory: '#409eff',
  factory_returned: '#909399',
  customer_notified: '#7c3aed',
  customer_picked: '#15803d',
};

export const STAGE_LABELS = {
  sent_factory: '已返厂维修',
  factory_returned: '厂家已寄回',
  customer_notified: '已通知客户',
  customer_picked: '客户已取走',
};

export const STAGE_ACTIONS = {
  sent_factory: '登记已返厂维修',
  factory_returned: '登记厂家已寄回',
  customer_notified: '登记已通知客户',
  customer_picked: '登记客户已取走',
};

export const NEXT_STAGE = {
  pending_factory: 'sent_factory',
  sent_factory: 'factory_returned',
  factory_returned: 'customer_notified',
  customer_notified: 'customer_picked',
};

export const HANDLING_OPTIONS = [
  { value: 'refund', label: '退款' },
  { value: 'exchange', label: '换货' },
  { value: 'repair', label: '维修' },
  { value: 'other', label: '其他' },
];

export const HANDLING_LABELS = Object.fromEntries(
  HANDLING_OPTIONS.map((item) => [item.value, item.label]),
);

export const HANDLING_TYPES = {
  refund: 'danger',
  exchange: 'warning',
  repair: 'primary',
  other: 'info',
};

export const PRODUCT_COLOR_OPTIONS = [
  '黑色',
  '白色',
  '米白色',
  '米色',
  '杏色',
  '奶油色',
  '裸色',
  '棕色',
  '深棕色',
  '咖啡色',
  '卡其色',
  '驼色',
  '灰色',
  '深灰色',
  '浅灰色',
  '红色',
  '酒红色',
  '枣红色',
  '粉色',
  '浅粉色',
  '玫红色',
  '蓝色',
  '深蓝色',
  '浅蓝色',
  '藏青色',
  '牛仔蓝',
  '绿色',
  '墨绿色',
  '浅绿色',
  '军绿色',
  '黄色',
  '姜黄色',
  '橙色',
  '紫色',
  '香芋紫',
  '银色',
  '金色',
  '多色',
];

export const PRODUCT_SIZE_OPTIONS = [
  '33',
  '34',
  '35',
  '36',
  '37',
  '38',
  '39',
  '40',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
  '47',
  '48',
  '均码',
];

export const REASON_OPTIONS = [
  '质量问题',
  '尺码不合适',
  '颜色/款式不喜欢',
  '发错货',
  '其他',
];

export const PRINT_LAYOUT_OPTIONS = [
  { value: 'label', label: '盒贴标签' },
  { value: 'full', label: '标准凭证 / 小票' },
];

export const AUDIT_ACTION_LABELS = {
  system_setup: '系统初始化',
  login: '登录',
  login_failed: '登录失败',
  logout: '退出登录',
  password_change: '修改密码',
  user_create: '新增账号',
  user_update: '修改账号',
  user_reset_password: '重置密码',
  product_create: '新增商品',
  product_update: '修改商品',
  product_delete: '删除商品',
  print_template_create: '新增打印模板',
  print_template_update: '修改打印模板',
  print_template_delete: '删除打印模板',
  settings_update: '修改系统设置',
  backup_create: '创建数据备份',
  backup_delete: '删除数据备份',
  backup_settings_update: '修改备份设置',
  backup_restore: '恢复数据备份',
  system_upgrade: '系统升级',
  license_import: '导入授权',
  license_trial_start: '开始试用',
  repair_create: '新增维修单',
  repair_update: '修改维修单',
  repair_status: '维修状态变更',
  repair_rework: '再次返厂',
  repair_undo: '撤销维修状态',
  repair_delete: '删除维修单',
  return_create: '新增退货单',
  return_update: '修改退货单',
  return_delete: '删除退货单',
};

export const ENTITY_TYPE_LABELS = {
  auth: '登录认证',
  user: '账号',
  product: '商品',
  print_template: '打印模板',
  settings: '系统设置',
  backup: '数据备份',
  system: '系统',
  license: '授权',
  repair: '维修单',
  return: '退货单',
};
