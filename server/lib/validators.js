import { z } from 'zod';
import { AppError } from './errors.js';
import { isValidDateString } from './date.js';
import {
  HANDLING_OPTIONS,
  REPAIR_STAGES,
} from './constants.js';

const dateString = z.string().refine(isValidDateString, '日期格式应为 YYYY-MM-DD');
const phone = z
  .string()
  .trim()
  .min(3, '电话至少 3 个字符')
  .max(30, '电话最多 30 个字符')
  .regex(/^[0-9+\-\s()]+$/, '电话格式不正确');
const optionalText = (max = 200) =>
  z.string().trim().max(max, `最多 ${max} 个字符`).optional().nullable();
const requiredText = (max = 200, label = '内容') =>
  z.string().trim().min(1, `${label}不能为空`).max(max, `${label}最多 ${max} 个字符`);

export const setupSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, '账号至少 3 个字符')
    .max(32, '账号最多 32 个字符')
    .regex(/^[a-zA-Z0-9_.-]+$/, '账号只能包含字母、数字、下划线、点和横线'),
  display_name: requiredText(50, '姓名'),
  password: z.string().min(8, '密码至少 8 个字符').max(72, '密码最多 72 个字符'),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, '请输入账号').max(32),
  password: z.string().min(1, '请输入密码').max(72),
});

export const changePasswordSchema = z.object({
  old_password: z.string().min(1, '请输入原密码').max(72),
  new_password: z.string().min(8, '新密码至少 8 个字符').max(72, '新密码最多 72 个字符'),
});

export const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, '账号至少 3 个字符')
    .max(32, '账号最多 32 个字符')
    .regex(/^[a-zA-Z0-9_.-]+$/, '账号只能包含字母、数字、下划线、点和横线'),
  display_name: requiredText(50, '姓名'),
  password: z.string().min(8, '密码至少 8 个字符').max(72, '密码最多 72 个字符'),
  role: z.enum(['admin', 'operator']).default('operator'),
});

export const updateUserSchema = z
  .object({
    display_name: requiredText(50, '姓名').optional(),
    role: z.enum(['admin', 'operator']).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, '没有需要修改的内容');

export const resetPasswordSchema = z.object({
  password: z.string().min(8, '密码至少 8 个字符').max(72, '密码最多 72 个字符'),
});

const productId = z.union([z.number().int().positive(), z.null()]).optional();

const repairBase = {
  repair_date: dateString.optional(),
  customer_name: requiredText(50, '顾客姓名'),
  phone,
  product_id: productId,
  product_name: optionalText(100),
  item_no: optionalText(100),
  color: optionalText(50),
  size: optionalText(50),
  problem: requiredText(2000, '问题描述'),
  remark: optionalText(2000),
};

export const createRepairSchema = z.object(repairBase);

export const updateRepairSchema = z
  .object({
    repair_date: dateString.optional(),
    customer_name: requiredText(50, '顾客姓名').optional(),
    phone: phone.optional(),
    product_id: productId,
    product_name: optionalText(100),
    item_no: optionalText(100),
    color: optionalText(50),
    size: optionalText(50),
    problem: requiredText(2000, '问题描述').optional(),
    remark: optionalText(2000),
  })
  .refine((value) => Object.keys(value).length > 0, '没有需要修改的内容');

const eventFields = {
  event_date: dateString.optional(),
  tracking_no: optionalText(100),
  remark: optionalText(2000),
};

export const repairStatusSchema = z.object({
  stage: z.enum(REPAIR_STAGES),
  ...eventFields,
});

export const repairReworkSchema = z.object({
  event_date: dateString.optional(),
  tracking_no: requiredText(100, '运单号'),
  remark: optionalText(2000),
});

const handlingValues = HANDLING_OPTIONS.map((item) => item.value);

const returnBase = {
  return_date: dateString.optional(),
  customer_name: requiredText(50, '顾客姓名'),
  phone,
  product_name: requiredText(100, '商品名称'),
  item_no: optionalText(100),
  color: optionalText(50),
  size: optionalText(50),
  purchase_date: z.union([dateString, z.literal('')]).optional().nullable(),
  receipt_no: optionalText(100),
  reason: requiredText(100, '退货原因'),
  handling: z.enum(handlingValues),
  refund_amount_cents: z.coerce.number().int().min(0).max(100000000).default(0),
  remark: optionalText(2000),
};

const productVariantSchema = z.object({
  color: optionalText(50),
  size: optionalText(50),
});

export const createProductSchema = z.object({
  item_no: requiredText(100, '货号'),
  name: requiredText(100, '商品名称'),
  variants: z.array(productVariantSchema).max(500, '规格数量不能超过 500 个').optional(),
  color: optionalText(50),
  size: optionalText(50),
  remark: optionalText(500),
});

export const updateProductSchema = z
  .object({
    item_no: requiredText(100, '货号').optional(),
    name: requiredText(100, '商品名称').optional(),
    variants: z.array(productVariantSchema).max(500, '规格数量不能超过 500 个').optional(),
    color: optionalText(50),
    size: optionalText(50),
    remark: optionalText(500),
  })
  .refine((value) => Object.keys(value).length > 0, '没有需要修改的内容');

const printTemplateFields = {
  name: requiredText(50, '模板名称'),
  layout: z.enum(['full', 'label']),
  paper_width_mm: z.coerce.number().min(20, '纸张宽度至少 20mm').max(300, '纸张宽度不能超过 300mm'),
  paper_height_mm: z.coerce.number().min(0).max(500, '纸张高度不能超过 500mm'),
  margin_mm: z.coerce.number().min(0).max(20, '页边距不能超过 20mm'),
  ticket_font_size: z.coerce.number().int().min(8, '单号字号至少 8').max(72, '单号字号不能超过 72'),
  base_font_size: z.coerce.number().int().min(6, '基础字号至少 6').max(24, '基础字号不能超过 24'),
  qr_size_mm: z.coerce.number().min(0).max(50, '二维码尺寸不能超过 50mm'),
  copies: z.coerce.number().int().min(1, '打印份数至少 1').max(20, '打印份数不能超过 20'),
  show_qr: z.boolean(),
  show_problem: z.boolean(),
  show_remark: z.boolean(),
  show_events: z.boolean(),
  show_signature: z.boolean(),
  show_shop_address: z.boolean(),
  is_default: z.boolean(),
};

export const createPrintTemplateSchema = z.object({
  ...printTemplateFields,
  copies: z.coerce.number().int().min(1).max(20).default(1),
  show_qr: z.boolean().default(true),
  show_problem: z.boolean().default(true),
  show_remark: z.boolean().default(false),
  show_events: z.boolean().default(false),
  show_signature: z.boolean().default(false),
  show_shop_address: z.boolean().default(true),
  is_default: z.boolean().default(false),
});

export const updatePrintTemplateSchema = z
  .object(printTemplateFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, '没有需要修改的内容');

export const updateSettingsSchema = z.object({
  system_name: requiredText(50, '系统名称'),
});

export const upgradePathSchema = z.object({
  new_path: requiredText(500, '新系统路径'),
});

export const licenseImportSchema = z.object({
  content_base64: z.string().min(1, '请选择授权文件').max(200000, '授权文件过大'),
});

export const backupSettingsSchema = z.object({
  enabled: z.boolean(),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, '备份时间格式应为 HH:mm'),
  retention: z.coerce
    .number()
    .int('保留数量必须是整数')
    .min(1, '至少保留 1 份')
    .max(365, '最多保留 365 份'),
});

export const createReturnSchema = z.object(returnBase);

export const updateReturnSchema = z
  .object({
    return_date: dateString.optional(),
    customer_name: requiredText(50, '顾客姓名').optional(),
    phone: phone.optional(),
    product_name: requiredText(100, '商品名称').optional(),
    item_no: optionalText(100),
    color: optionalText(50),
    size: optionalText(50),
    purchase_date: z.union([dateString, z.literal('')]).optional().nullable(),
    receipt_no: optionalText(100),
    reason: requiredText(100, '退货原因').optional(),
    handling: z.enum(handlingValues).optional(),
    refund_amount_cents: z.coerce.number().int().min(0).max(100000000).optional(),
    remark: optionalText(2000),
  })
  .refine((value) => Object.keys(value).length > 0, '没有需要修改的内容');

export function pagination(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function dateRange(query = {}) {
  const from = query.dateFrom ? String(query.dateFrom) : null;
  const to = query.dateTo ? String(query.dateTo) : null;
  if (from && !isValidDateString(from)) throw new AppError(400, '开始日期格式不正确');
  if (to && !isValidDateString(to)) throw new AppError(400, '结束日期格式不正确');
  return { from, to };
}
