import { createRouter, createWebHistory } from 'vue-router';
import { auth, bootstrap } from '../stores/auth';
import { license, loadLicenseStatus } from '../stores/license';
import { appTitle, loadPublicSettings, settings } from '../stores/settings';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { title: '登录', standalone: true },
  },
  {
    path: '/setup',
    name: 'setup',
    component: () => import('../views/SetupView.vue'),
    meta: { title: '系统初始化', standalone: true },
  },
  {
    path: '/change-password',
    name: 'change-password',
    component: () => import('../views/ChangePasswordView.vue'),
    meta: { title: '修改密码', standalone: true, requiresAuth: true },
  },
  {
    path: '/',
    component: () => import('../layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('../views/DashboardView.vue'),
        meta: { title: '首页', requiresAuth: true },
      },
      {
        path: 'products',
        name: 'products',
        component: () => import('../views/ProductsView.vue'),
        meta: { title: '商品管理', requiresAuth: true },
      },
      {
        path: 'repairs',
        name: 'repairs',
        component: () => import('../views/repairs/RepairListView.vue'),
        meta: { title: '维修管理', requiresAuth: true },
      },
      {
        path: 'repairs/new',
        name: 'repair-new',
        component: () => import('../views/repairs/RepairFormView.vue'),
        meta: { title: '新增维修单', requiresAuth: true },
      },
      {
        path: 'repairs/:id',
        name: 'repair-detail',
        component: () => import('../views/repairs/RepairDetailView.vue'),
        meta: { title: '维修详情', requiresAuth: true },
      },
      {
        path: 'returns',
        name: 'returns',
        component: () => import('../views/returns/ReturnListView.vue'),
        meta: { title: '退货管理', requiresAuth: true },
      },
      {
        path: 'returns/new',
        name: 'return-new',
        component: () => import('../views/returns/ReturnFormView.vue'),
        meta: { title: '新增退货单', requiresAuth: true },
      },
      {
        path: 'returns/:id',
        name: 'return-detail',
        component: () => import('../views/returns/ReturnDetailView.vue'),
        meta: { title: '退货详情', requiresAuth: true },
      },
      {
        path: 'returns/:id/edit',
        name: 'return-edit',
        component: () => import('../views/returns/ReturnFormView.vue'),
        meta: { title: '编辑退货单', requiresAuth: true },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('../views/SettingsView.vue'),
        meta: { title: '系统名称', requiresAuth: true, admin: true },
      },
      {
        path: 'print-settings',
        name: 'print-settings',
        component: () => import('../views/PrintSettingsView.vue'),
        meta: { title: '打印设置', requiresAuth: true },
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('../views/UsersView.vue'),
        meta: { title: '账号管理', requiresAuth: true, admin: true },
      },
      {
        path: 'audit-logs',
        name: 'audit-logs',
        component: () => import('../views/AuditLogsView.vue'),
        meta: { title: '操作日志', requiresAuth: true, admin: true },
      },
      {
        path: 'backups',
        name: 'backups',
        component: () => import('../views/DataBackupView.vue'),
        meta: { title: '备份恢复', requiresAuth: true, admin: true },
      },
      {
        path: 'upgrade',
        name: 'system-upgrade',
        component: () => import('../views/SystemUpgradeView.vue'),
        meta: { title: '系统升级', requiresAuth: true, admin: true },
      },
      {
        path: 'license',
        name: 'license',
        component: () => import('../views/LicenseView.vue'),
        meta: { title: '授权信息', requiresAuth: true },
      },
    ],
  },
  {
    path: '/status/:token',
    name: 'repair-status',
    component: () => import('../views/PublicRepairStatusView.vue'),
    meta: { title: '维修进度查询', standalone: true, public: true },
  },
  {
    path: '/print/repair/:id',
    name: 'repair-print',
    component: () => import('../views/print/RepairPrintView.vue'),
    meta: { title: '打印维修凭证', requiresAuth: true, standalone: true },
  },
  {
    path: '/print/return/:id',
    name: 'return-print',
    component: () => import('../views/print/ReturnPrintView.vue'),
    meta: { title: '打印退货凭证', requiresAuth: true, standalone: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue'),
    meta: { title: '页面不存在', standalone: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  if (!settings.loaded) {
    await loadPublicSettings();
  }

  if (!auth.checked) {
    try {
      await bootstrap();
    } catch {
      auth.checked = true;
    }
  }

  if (auth.needsSetup && to.name !== 'setup') return { name: 'setup' };
  if (!auth.needsSetup && to.name === 'setup') {
    return auth.user ? { name: 'dashboard' } : { name: 'login' };
  }

  if (to.meta.requiresAuth && !auth.user) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (auth.user?.must_change_password && to.name !== 'change-password' && !to.meta.public) {
    return { name: 'change-password' };
  }

  if (auth.user && !license.checked) {
    await loadLicenseStatus();
  }

  const licenseBlocked = auth.user && license.status?.allowed === false;
  const licenseAllowedRoutes = new Set([
    'license',
    'backups',
    'system-upgrade',
    'change-password',
    'login',
  ]);
  if (licenseBlocked && !licenseAllowedRoutes.has(to.name)) {
    return { name: 'license' };
  }

  if (to.name === 'login' && auth.user) {
    if (auth.user.must_change_password) return { name: 'change-password' };
    return licenseBlocked ? { name: 'license' } : { name: 'dashboard' };
  }

  if (to.meta.admin && auth.user?.role !== 'admin') {
    return { name: 'dashboard' };
  }

  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} - ${appTitle()}` : appTitle();
});

export default router;
