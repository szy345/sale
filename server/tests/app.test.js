import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import test, { after, before } from 'node:test';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yearcon-sale-test-'));
process.env.NODE_ENV = 'test';
process.env.YK_DATA_DIR = tempDir;
process.env.YK_LICENSE_STATE_DIR = path.join(tempDir, 'license-state');
process.env.YK_MACHINE_CODE = 'TEST-MACHINE-CODE';
process.env.YK_JWT_SECRET = 'test-secret-key-for-yearcon-sale-system';

const { createApp } = await import('../app.js');
const { closeDb } = await import('../db.js');

const app = createApp();
const adminAgent = request.agent(app);
const operatorAgent = request.agent(app);
let repairId;
let returnId;
let operatorId;

before(async () => {
  const status = await request(app).get('/api/setup/status');
  assert.equal(status.status, 200);
  assert.equal(status.body.needsSetup, true);

  const setup = await adminAgent.post('/api/setup').send({
    username: 'admin',
    display_name: '店长',
    password: 'AdminPass123',
  });
  assert.equal(setup.status, 201);
  assert.equal(setup.body.user.role, 'admin');
  assert.equal(setup.body.user.must_change_password, false);

  const again = await request(app).post('/api/setup').send({
    username: 'admin2',
    display_name: '店长2',
    password: 'AdminPass123',
  });
  assert.equal(again.status, 409);

  const created = await adminAgent.post('/api/users').send({
    username: 'operator',
    display_name: '操作员小李',
    password: 'Operator123',
    role: 'operator',
  });
  assert.equal(created.status, 201);
  operatorId = created.body.id;

  const login = await operatorAgent.post('/api/auth/login').send({
    username: 'operator',
    password: 'Operator123',
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.must_change_password, true);

  const blocked = await operatorAgent.get('/api/dashboard');
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, 'PASSWORD_CHANGE_REQUIRED');

  const changed = await operatorAgent.post('/api/auth/change-password').send({
    old_password: 'Operator123',
    new_password: 'Operator456',
  });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.user.must_change_password, false);

  const dashboard = await operatorAgent.get('/api/dashboard');
  assert.equal(dashboard.status, 200);
});

after(() => {
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('权限控制：操作员不能管理账号或查看更多日志', async () => {
  const createUser = await operatorAgent.post('/api/users').send({
    username: 'nobody',
    display_name: '无权限',
    password: 'Nobody123',
    role: 'operator',
  });
  assert.equal(createUser.status, 403);

  const audit = await operatorAgent.get('/api/audit-logs');
  assert.equal(audit.status, 403);

  const patchSelf = await adminAgent.patch('/api/users/1').send({ role: 'operator' });
  assert.equal(patchSelf.status, 400);
});

test('维修单：创建、顺序流转、运单号校验、再次返厂和撤销', async () => {
  const created = await operatorAgent.post('/api/repairs').send({
    repair_date: '2026-10-19',
    customer_name: '张三',
    phone: '13800138000',
    product_name: '女士皮鞋',
    item_no: 'YK-1001',
    color: '黑色',
    size: '38',
    problem: '鞋底开胶',
    remark: '顾客要求尽快',
  });
  assert.equal(created.status, 201);
  assert.match(created.body.ticket_no, /^WX-\d{8}-\d{4}$/);
  assert.equal(created.body.status, 'pending_factory');
  assert.equal(created.body.current_round, 1);
  assert.match(created.body.public_token, /^[a-f0-9]{32}$/);
  repairId = created.body.id;

  const skip = await operatorAgent
    .post(`/api/repairs/${repairId}/status`)
    .send({ stage: 'factory_returned', event_date: '2026-10-19' });
  assert.equal(skip.status, 409);

  const noTracking = await operatorAgent
    .post(`/api/repairs/${repairId}/status`)
    .send({ stage: 'sent_factory', event_date: '2026-10-19' });
  assert.equal(noTracking.status, 400);

  const sent = await operatorAgent.post(`/api/repairs/${repairId}/status`).send({
    stage: 'sent_factory',
    event_date: '2026-10-19',
    tracking_no: 'SF100000001',
    remark: '已寄出',
  });
  assert.equal(sent.status, 200);
  assert.equal(sent.body.status, 'sent_factory');
  assert.equal(sent.body.events.length, 1);

  const returned = await operatorAgent.post(`/api/repairs/${repairId}/status`).send({
    stage: 'factory_returned',
    event_date: '2026-10-21',
    tracking_no: 'SF100000002',
  });
  assert.equal(returned.status, 200);
  assert.equal(returned.body.status, 'factory_returned');

  const notified = await operatorAgent.post(`/api/repairs/${repairId}/status`).send({
    stage: 'customer_notified',
    event_date: '2026-10-21',
    remark: '已电话通知',
  });
  assert.equal(notified.status, 200);

  const picked = await operatorAgent.post(`/api/repairs/${repairId}/status`).send({
    stage: 'customer_picked',
    event_date: '2026-10-22',
  });
  assert.equal(picked.status, 200);
  assert.equal(picked.body.status, 'customer_picked');
  assert.equal(picked.body.events.length, 4);

  const completed = await operatorAgent
    .post(`/api/repairs/${repairId}/status`)
    .send({ stage: 'sent_factory' });
  assert.equal(completed.status, 409);

  const rework = await operatorAgent.post(`/api/repairs/${repairId}/rework`).send({
    event_date: '2026-10-25',
    tracking_no: 'SF100000003',
    remark: '客户反馈仍有问题',
  });
  assert.equal(rework.status, 200);
  assert.equal(rework.body.status, 'sent_factory');
  assert.equal(rework.body.current_round, 2);
  assert.equal(rework.body.events.filter((event) => event.round_no === 2).length, 1);

  const round2Returned = await operatorAgent.post(`/api/repairs/${repairId}/status`).send({
    stage: 'factory_returned',
    event_date: '2026-10-28',
    tracking_no: 'SF100000004',
  });
  assert.equal(round2Returned.status, 200);
  assert.equal(round2Returned.body.events.filter((event) => event.round_no === 2).length, 2);

  const undoReturned = await adminAgent.post(`/api/repairs/${repairId}/undo-last`);
  assert.equal(undoReturned.status, 200);
  assert.equal(undoReturned.body.status, 'sent_factory');
  assert.equal(undoReturned.body.current_round, 2);

  const undoRework = await adminAgent.post(`/api/repairs/${repairId}/undo-last`);
  assert.equal(undoRework.status, 200);
  assert.equal(undoRework.body.status, 'customer_picked');
  assert.equal(undoRework.body.current_round, 1);

  const undoOperator = await operatorAgent.post(`/api/repairs/${repairId}/undo-last`);
  assert.equal(undoOperator.status, 403);

  const updated = await operatorAgent.patch(`/api/repairs/${repairId}`).send({
    remark: '已更新备注',
    color: '深黑色',
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.remark, '已更新备注');
  assert.equal(updated.body.color, '深黑色');

  const detail = await operatorAgent.get(`/api/repairs/${repairId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.ticket_no, created.body.ticket_no);
  assert.equal(detail.body.events.length, 6);

  const hidden = await operatorAgent
    .get('/api/repairs')
    .query({ excludeStatus: 'customer_picked', pageSize: 100 });
  assert.equal(hidden.status, 200);
  assert.ok(!hidden.body.items.some((item) => item.id === repairId));
});

test('维修单：四位连续编号、列表筛选正常', async () => {
  const before = await operatorAgent.get('/api/repairs').query({ pageSize: 100 });
  const maxSuffix = Math.max(
    0,
    ...before.body.items.map((item) => Number(String(item.ticket_no).split('-').pop())),
  );

  const created = await operatorAgent.post('/api/repairs').send({
    customer_name: '李四',
    phone: '13900139000',
    product_name: '男士休闲鞋',
    problem: '鞋面破损',
  });
  assert.equal(created.status, 201);
  assert.match(created.body.ticket_no, /^WX-\d{8}-\d{4}$/);
  assert.equal(Number(created.body.ticket_no.split('-').pop()), maxSuffix + 1);

  const list = await operatorAgent.get('/api/repairs').query({ keyword: '李四' });
  assert.equal(list.status, 200);
  assert.equal(list.body.total, 1);
  assert.equal(list.body.items[0].customer_name, '李四');

  const byStatus = await operatorAgent
    .get('/api/repairs')
    .query({ status: 'pending_factory', pageSize: 50 });
  assert.equal(byStatus.status, 200);
  assert.ok(byStatus.body.items.some((item) => item.id === created.body.id));
});

test('公开维修进度：扫码可查询状态，并隐藏完整顾客信息', async () => {
  const detail = await operatorAgent.get(`/api/repairs/${repairId}`);
  const token = detail.body.public_token;

  const publicStatus = await request(app).get(`/api/public/repairs/${token}`);
  assert.equal(publicStatus.status, 200);
  assert.equal(publicStatus.body.repair.ticket_no, detail.body.ticket_no);
  assert.equal(publicStatus.body.repair.status, 'customer_picked');
  assert.equal(publicStatus.body.repair.customer_name, '张*');
  assert.equal(publicStatus.body.repair.phone, '138****8000');
  assert.ok(publicStatus.body.repair.events.length > 0);
  assert.equal(publicStatus.body.repair.problem, undefined);

  const invalid = await request(app).get('/api/public/repairs/not-a-valid-token');
  assert.equal(invalid.status, 404);
});

test('退货单：登记、查询、修改、权限和删除', async () => {
  const created = await operatorAgent.post('/api/returns').send({
    return_date: '2026-10-19',
    customer_name: '王五',
    phone: '13700137000',
    product_name: '女士短靴',
    item_no: 'YK-2002',
    color: '棕色',
    size: '37',
    purchase_date: '2026-10-01',
    receipt_no: 'R20261001001',
    reason: '质量问题',
    handling: 'refund',
    refund_amount_cents: 59900,
    remark: '鞋底断裂',
  });
  assert.equal(created.status, 201);
  assert.match(created.body.return_no, /^TH-\d{8}-\d{3}$/);
  assert.equal(created.body.refund_amount_cents, 59900);
  returnId = created.body.id;

  const list = await operatorAgent.get('/api/returns').query({ handling: 'refund' });
  assert.equal(list.status, 200);
  assert.equal(list.body.total, 1);

  const updated = await operatorAgent.patch(`/api/returns/${returnId}`).send({
    handling: 'exchange',
    refund_amount_cents: 0,
    reason: '尺码不合适',
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.handling, 'exchange');

  const operatorDelete = await operatorAgent.delete(`/api/returns/${returnId}`);
  assert.equal(operatorDelete.status, 403);

  const detail = await adminAgent.get(`/api/returns/${returnId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.receipt_no, 'R20261001001');
});

test('商品管理：多颜色和尺码、货号唯一、维修规格校验、修改和删除', async () => {
  const created = await operatorAgent.post('/api/products').send({
    item_no: 'YK-3001',
    name: '测试女鞋',
    variants: [
      { color: '黑色', size: '38' },
      { color: '黑色', size: '39' },
      { color: '白色', size: '38' },
      { color: '白色', size: '39' },
      { color: '棕色', size: '38' },
    ],
    remark: '商品管理测试',
  });
  assert.equal(created.status, 201);
  const productId = created.body.id;
  assert.equal(created.body.variants.length, 5);

  const duplicate = await operatorAgent.post('/api/products').send({
    item_no: 'YK-3001',
    name: '重复货号',
  });
  assert.equal(duplicate.status, 409);

  const options = await operatorAgent.get('/api/products/options');
  assert.equal(options.status, 200);
  const option = options.body.items.find((item) => item.id === productId);
  assert.ok(option);
  assert.equal(option.item_no, 'YK-3001');
  assert.equal(option.variants.length, 5);

  const byColor = await operatorAgent.get('/api/products').query({ keyword: '棕色' });
  assert.equal(byColor.status, 200);
  assert.equal(byColor.body.total, 1);

  const repair = await operatorAgent.post('/api/repairs').send({
    product_id: productId,
    product_name: '伪造名称',
    item_no: 'FAKE-001',
    color: '白色',
    size: '39',
    customer_name: '商品测试顾客',
    phone: '13500135000',
    problem: '商品自动填充测试',
  });
  assert.equal(repair.status, 201);
  assert.equal(repair.body.product_id, productId);
  assert.equal(repair.body.product_name, '测试女鞋');
  assert.equal(repair.body.item_no, 'YK-3001');
  assert.equal(repair.body.color, '白色');
  assert.equal(repair.body.size, '39');

  const invalidVariant = await operatorAgent.post('/api/repairs').send({
    product_id: productId,
    color: '绿色',
    size: '42',
    customer_name: '无效规格顾客',
    phone: '13500135001',
    problem: '无效规格测试',
  });
  assert.equal(invalidVariant.status, 400);

  const updatedProduct = await operatorAgent.patch(`/api/products/${productId}`).send({
    name: '测试女鞋升级',
    variants: [
      { color: '深黑色', size: '38' },
      { color: '深黑色', size: '40' },
      { color: '米白色', size: '39' },
    ],
  });
  assert.equal(updatedProduct.status, 200);
  assert.equal(updatedProduct.body.name, '测试女鞋升级');
  assert.equal(updatedProduct.body.variants.length, 3);

  const updatedRepair = await operatorAgent.patch(`/api/repairs/${repair.body.id}`).send({
    product_id: productId,
    color: '深黑色',
    size: '40',
    problem: '更新后的商品问题',
  });
  assert.equal(updatedRepair.status, 200);
  assert.equal(updatedRepair.body.product_name, '测试女鞋升级');
  assert.equal(updatedRepair.body.item_no, 'YK-3001');
  assert.equal(updatedRepair.body.color, '深黑色');
  assert.equal(updatedRepair.body.size, '40');

  const operatorDelete = await operatorAgent.delete(`/api/products/${productId}`);
  assert.equal(operatorDelete.status, 403);

  const adminDelete = await adminAgent.delete(`/api/products/${productId}`);
  assert.equal(adminDelete.status, 200);

  const afterDelete = await operatorAgent.get(`/api/repairs/${repair.body.id}`);
  assert.equal(afterDelete.status, 200);
  assert.equal(afterDelete.body.product_id, null);
  assert.equal(afterDelete.body.product_name, '测试女鞋升级');
  assert.equal(afterDelete.body.item_no, 'YK-3001');
  assert.equal(afterDelete.body.color, '深黑色');
  assert.equal(afterDelete.body.size, '40');
});

test('打印模板：默认模板、操作员可设置、字号修改和删除', async () => {
  const initial = await operatorAgent.get('/api/print-templates');
  assert.equal(initial.status, 200);
  assert.ok(initial.body.items.length >= 6);
  const initialDefault = initial.body.items.find((item) => item.is_default);
  assert.ok(initialDefault);
  assert.equal(initialDefault.layout, 'label');
  assert.equal(initialDefault.ticket_font_size, 20);

  const created = await operatorAgent.post('/api/print-templates').send({
    name: '测试 45×35 标签',
    layout: 'label',
    paper_width_mm: 45,
    paper_height_mm: 35,
    margin_mm: 0,
    ticket_font_size: 22,
    base_font_size: 9,
    qr_size_mm: 15,
    copies: 2,
    show_qr: true,
    show_problem: true,
    show_remark: false,
    show_events: false,
    show_signature: false,
    show_shop_address: false,
    is_default: true,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.is_default, true);
  assert.equal(created.body.ticket_font_size, 22);
  assert.equal(created.body.copies, 2);

  const defaults = (await operatorAgent.get('/api/print-templates')).body.items.filter(
    (item) => item.is_default,
  );
  assert.equal(defaults.length, 1);
  assert.equal(defaults[0].id, created.body.id);

  const updated = await operatorAgent.patch(`/api/print-templates/${created.body.id}`).send({
    ticket_font_size: 26,
    copies: 3,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.ticket_font_size, 26);
  assert.equal(updated.body.copies, 3);

  const invalid = await adminAgent.post('/api/print-templates').send({
    name: '无效宽度',
    layout: 'label',
    paper_width_mm: 5,
    paper_height_mm: 30,
    margin_mm: 0,
    ticket_font_size: 20,
    base_font_size: 9,
    qr_size_mm: 15,
  });
  assert.equal(invalid.status, 400);

  const invalidCopies = await adminAgent.post('/api/print-templates').send({
    name: '无效份数',
    layout: 'label',
    paper_width_mm: 45,
    paper_height_mm: 35,
    margin_mm: 0,
    ticket_font_size: 20,
    base_font_size: 9,
    qr_size_mm: 15,
    copies: 0,
  });
  assert.equal(invalidCopies.status, 400);

  const deleted = await operatorAgent.delete(`/api/print-templates/${created.body.id}`);
  assert.equal(deleted.status, 200);

  const after = await operatorAgent.get('/api/print-templates');
  assert.equal(after.status, 200);
  assert.equal(after.body.items.filter((item) => item.is_default).length, 1);
  assert.ok(!after.body.items.some((item) => item.id === created.body.id));
});

test('系统设置：系统名称同步到公共配置和打印元数据', async () => {
  const initial = await request(app).get('/api/settings/public');
  assert.equal(initial.status, 200);
  assert.equal(initial.body.systemName, 'xxx');
  assert.equal(initial.body.version, '1.2.0');

  const operatorUpdate = await operatorAgent.patch('/api/settings').send({
    system_name: '无权限系统',
  });
  assert.equal(operatorUpdate.status, 403);

  const updated = await adminAgent.patch('/api/settings').send({
    system_name: '测试维保系统',
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.systemName, '测试维保系统');

  const publicAfter = await request(app).get('/api/settings/public');
  assert.equal(publicAfter.body.systemName, '测试维保系统');

  const meta = await operatorAgent.get('/api/meta');
  assert.equal(meta.status, 200);
  assert.equal(meta.body.systemName, '测试维保系统');
  assert.equal(meta.body.shop.name, '测试维保系统');
});

test('数据备份：管理员手动备份、下载、删除和自动备份设置', async () => {
  const operatorList = await operatorAgent.get('/api/backups');
  assert.equal(operatorList.status, 403);

  const initial = await adminAgent.get('/api/backups');
  assert.equal(initial.status, 200);
  assert.equal(initial.body.settings.enabled, true);
  assert.equal(initial.body.settings.time, '02:00');
  assert.ok(Array.isArray(initial.body.files));

  const operatorCreate = await operatorAgent.post('/api/backups');
  assert.equal(operatorCreate.status, 403);

  const operatorRestore = await operatorAgent.post('/api/backups/manual-missing.db/restore');
  assert.equal(operatorRestore.status, 403);

  const missingRestore = await adminAgent.post('/api/backups/manual-missing.db/restore');
  assert.equal(missingRestore.status, 404);

  const created = await adminAgent.post('/api/backups');
  assert.equal(created.status, 201);
  assert.match(created.body.name, /^manual-\d{8}-\d{6}(?:-\d+)?\.db$/);
  assert.ok(created.body.size > 0);

  const list = await adminAgent.get('/api/backups');
  assert.ok(list.body.files.some((file) => file.name === created.body.name && file.type === 'manual'));

  const download = await adminAgent.get(
    `/api/backups/${encodeURIComponent(created.body.name)}/download`,
  );
  assert.equal(download.status, 200);
  assert.match(download.headers['content-disposition'] || '', /attachment/i);

  const settings = await adminAgent.patch('/api/backups/settings').send({
    enabled: false,
    time: '03:30',
    retention: 7,
  });
  assert.equal(settings.status, 200);
  assert.equal(settings.body.enabled, false);
  assert.equal(settings.body.time, '03:30');
  assert.equal(settings.body.retention, 7);

  const deleted = await adminAgent.delete(
    `/api/backups/${encodeURIComponent(created.body.name)}`,
  );
  assert.equal(deleted.status, 200);

  const missing = await adminAgent.delete(
    `/api/backups/${encodeURIComponent(created.body.name)}`,
  );
  assert.equal(missing.status, 404);
});

test('授权：试用状态和非法授权导入', async () => {
  const status = await operatorAgent.get('/api/license/status');
  assert.equal(status.status, 200);
  assert.equal(status.body.status, 'trial');
  assert.equal(status.body.allowed, true);
  assert.equal(status.body.machine_code, 'TEST-MACHINE-CODE');
  assert.ok(status.body.days_remaining > 0);

  const invalidPayload = Buffer.from(
    JSON.stringify({ payload: {}, signature: 'invalid' }),
  ).toString('base64');
  const operatorImport = await operatorAgent.post('/api/license/import').send({
    content_base64: invalidPayload,
  });
  assert.equal(operatorImport.status, 403);

  const adminImport = await adminAgent.post('/api/license/import').send({
    content_base64: invalidPayload,
  });
  assert.equal(adminImport.status, 400);

  const after = await adminAgent.get('/api/license/status');
  assert.equal(after.body.status, 'trial');
});

test('系统升级：管理员检查路径，操作员无权限，非法路径不会触发升级', async () => {
  const operatorInfo = await operatorAgent.get('/api/upgrade/info');
  assert.equal(operatorInfo.status, 403);

  const info = await adminAgent.get('/api/upgrade/info');
  assert.equal(info.status, 200);
  assert.equal(info.body.currentVersion, '1.2.0');
  assert.ok(info.body.currentRoot);

  const operatorValidate = await operatorAgent.post('/api/upgrade/validate').send({
    new_path: 'D:\\yearcon-does-not-exist',
  });
  assert.equal(operatorValidate.status, 403);

  const invalidPath = await adminAgent.post('/api/upgrade/validate').send({
    new_path: 'D:\\yearcon-does-not-exist',
  });
  assert.equal(invalidPath.status, 200);
  assert.equal(invalidPath.body.valid, false);
  assert.ok(invalidPath.body.errors.length > 0);

  const invalidUpgrade = await adminAgent.post('/api/upgrade').send({
    new_path: 'D:\\yearcon-does-not-exist',
  });
  assert.equal(invalidUpgrade.status, 400);
  assert.equal(invalidUpgrade.body.code, 'UPGRADE_INVALID');
});

test('首页统计和审计日志', async () => {
  const dashboard = await adminAgent.get('/api/dashboard');
  assert.equal(dashboard.status, 200);
  assert.ok(dashboard.body.counts.totalRepairs >= 2);
  assert.ok(dashboard.body.counts.totalReturns >= 1);
  assert.ok(dashboard.body.counts.customerPicked >= 1);
  assert.ok(Array.isArray(dashboard.body.recentRepairs));

  const logs = await adminAgent.get('/api/audit-logs').query({ pageSize: 100 });
  assert.equal(logs.status, 200);
  assert.ok(logs.body.items.some((item) => item.action === 'repair_create'));
  assert.ok(logs.body.items.some((item) => item.action === 'repair_rework'));
  assert.ok(logs.body.items.some((item) => item.action === 'repair_undo'));
  assert.ok(logs.body.items.some((item) => item.action === 'return_update'));
  assert.ok(logs.body.items.some((item) => item.action === 'product_create'));
  assert.ok(logs.body.items.some((item) => item.action === 'product_update'));
  assert.ok(logs.body.items.some((item) => item.action === 'product_delete'));
  assert.ok(logs.body.items.some((item) => item.action === 'print_template_create'));
  assert.ok(logs.body.items.some((item) => item.action === 'print_template_update'));
  assert.ok(logs.body.items.some((item) => item.action === 'print_template_delete'));
  assert.ok(logs.body.items.some((item) => item.action === 'settings_update'));
  assert.ok(logs.body.items.some((item) => item.action === 'backup_create'));
  assert.ok(logs.body.items.some((item) => item.action === 'backup_settings_update'));
  assert.ok(logs.body.items.some((item) => item.action === 'backup_delete'));

  const actions = await adminAgent.get('/api/audit-logs/actions');
  assert.equal(actions.status, 200);
  assert.ok(actions.body.items.includes('login'));

  const filtered = await adminAgent.get('/api/audit-logs').query({ action: 'repair_create' });
  assert.equal(filtered.status, 200);
  assert.ok(filtered.body.items.every((item) => item.action === 'repair_create'));
});

test('管理员删除维修单，操作员不能删除', async () => {
  const created = await adminAgent.post('/api/repairs').send({
    customer_name: '赵六',
    phone: '13600136000',
    problem: '待删除测试',
  });
  assert.equal(created.status, 201);

  const operatorDelete = await operatorAgent.delete(`/api/repairs/${created.body.id}`);
  assert.equal(operatorDelete.status, 403);

  const deleted = await adminAgent.delete(`/api/repairs/${created.body.id}`);
  assert.equal(deleted.status, 200);

  const missing = await adminAgent.get(`/api/repairs/${created.body.id}`);
  assert.equal(missing.status, 404);
});

test('登录失败与登出', async () => {
  const agent = request.agent(app);
  const failed = await agent.post('/api/auth/login').send({
    username: 'operator',
    password: 'wrong-password',
  });
  assert.equal(failed.status, 401);

  const login = await agent.post('/api/auth/login').send({
    username: 'operator',
    password: 'Operator456',
  });
  assert.equal(login.status, 200);

  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.id, operatorId);

  const logout = await agent.post('/api/auth/logout');
  assert.equal(logout.status, 200);

  const afterLogout = await agent.get('/api/auth/me');
  assert.equal(afterLogout.status, 401);
});
