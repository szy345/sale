<template>
  <el-container class="app-shell">
    <el-aside width="220px" class="sidebar desktop-sidebar">
      <div class="brand">
        <div class="brand-mark">{{ brandMark }}</div>
        <div>
          <div class="brand-name">{{ settings.systemName }}</div>
          <div class="brand-sub">销售维保系统</div>
        </div>
      </div>
      <SideMenu />
      <div class="sidebar-footer">
        <span>{{ roleLabel(auth.user?.role) }}</span>
        <span>v1.0</span>
      </div>
    </el-aside>

    <el-drawer
      v-model="drawerVisible"
      direction="ltr"
      :size="230"
      :with-header="false"
      class="mobile-drawer"
    >
      <div class="sidebar drawer-sidebar">
        <div class="brand">
          <div class="brand-mark">{{ brandMark }}</div>
          <div>
            <div class="brand-name">{{ settings.systemName }}</div>
            <div class="brand-sub">销售维保系统</div>
          </div>
        </div>
        <SideMenu @select="drawerVisible = false" />
      </div>
    </el-drawer>

    <el-container class="content-shell">
      <el-header class="topbar">
        <div class="topbar-left">
          <el-button class="menu-button" text circle @click="drawerVisible = true">
            <el-icon :size="22"><Menu /></el-icon>
          </el-button>
          <div>
            <h1>{{ route.meta.title || `${settings.systemName}销售维保系统` }}</h1>
            <p class="topbar-date">{{ todayText }}</p>
          </div>
        </div>

        <div class="topbar-right">
          <button
            v-if="licenseBadge"
            type="button"
            class="license-badge"
            :class="licenseBadge.className"
            :title="license.status?.message"
            @click="router.push('/license')"
          >
            {{ licenseBadge.text }}
          </button>

          <el-tooltip content="关于" placement="bottom">
            <button
              class="about-button"
              type="button"
              aria-label="关于"
              @click="aboutVisible = true"
            >
              <el-icon :size="18"><InfoFilled /></el-icon>
              <span class="about-text">关于</span>
            </button>
          </el-tooltip>

          <el-dropdown trigger="click" @command="handleCommand">
            <button class="user-chip" type="button">
              <span class="avatar">{{ initials }}</span>
              <span class="user-meta">
                <strong>{{ auth.user?.display_name }}</strong>
                <small>{{ roleLabel(auth.user?.role) }}</small>
              </span>
              <el-icon><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="password">
                  <el-icon><Lock /></el-icon>修改密码
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main-area">
        <router-view />
      </el-main>
    </el-container>
  </el-container>

  <el-dialog
    v-model="aboutVisible"
    title="关于"
    width="min(420px, 92vw)"
    class="about-dialog"
  >
    <div class="about-content">
      <div class="about-logo">{{ brandMark }}</div>
      <h2>{{ settings.systemName }}销售维保系统</h2>
      <p class="about-version">版本 {{ settings.version }}</p>
      <div class="about-divider"></div>
      <div class="about-info">
        <div class="about-row">
          <span>开发</span>
          <strong>数治技术工作室</strong>
        </div>
        <div class="about-row">
          <span>顾问</span>
          <strong>沈先生</strong>
        </div>
        <div class="about-row">
          <span>联系电话</span>
          <a href="tel:13675182937">13675182937</a>
        </div>
      </div>
      <p class="about-footer">感谢使用</p>
    </div>
    <template #footer>
      <el-button type="primary" @click="aboutVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import dayjs from 'dayjs';
import SideMenu from '../components/SideMenu.vue';
import { auth, logout } from '../stores/auth';
import { license } from '../stores/license';
import { settings } from '../stores/settings';
import { roleLabel } from '../utils/format';

const route = useRoute();
const router = useRouter();
const drawerVisible = ref(false);
const aboutVisible = ref(false);

const initials = computed(() => (auth.user?.display_name || '?').slice(0, 1));
const brandMark = computed(() => (settings.systemName || '系统').slice(0, 2));
const todayText = computed(() => dayjs().format('YYYY年MM月DD日 dddd'));
const licenseBadge = computed(() => {
  const status = license.status;
  if (!status) return null;
  if (status.status === 'licensed') {
    return { text: '已授权', className: 'license-ok' };
  }
  if (status.status === 'trial') {
    return {
      text: `试用 ${status.days_remaining ?? ''} 天`,
      className: 'license-trial',
    };
  }
  if (status.status === 'pending') {
    return { text: '待初始化', className: 'license-muted' };
  }
  if (status.status === 'expired') {
    return { text: '授权已到期', className: 'license-bad' };
  }
  return { text: '授权异常', className: 'license-bad' };
});

watch(
  () => route.path,
  () => {
    drawerVisible.value = false;
  },
);

async function handleCommand(command) {
  if (command === 'password') {
    router.push('/change-password');
    return;
  }
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '退出',
        cancelButtonText: '取消',
        type: 'warning',
      });
    } catch {
      return;
    }
    await logout();
    ElMessage.success('已退出登录');
    router.replace('/login');
  }
}
</script>
