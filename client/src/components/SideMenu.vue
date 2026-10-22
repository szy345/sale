<template>
  <el-menu
    :default-active="active"
    router
    class="side-menu"
    background-color="transparent"
    text-color="#f4dce0"
    active-text-color="#ffffff"
    @select="$emit('select')"
  >
    <el-menu-item index="/">
      <el-icon><HomeFilled /></el-icon>
      <span>首页</span>
    </el-menu-item>
    <el-menu-item index="/repairs">
      <el-icon><Tools /></el-icon>
      <span>维修管理</span>
    </el-menu-item>
    <el-menu-item index="/returns">
      <el-icon><RefreshLeft /></el-icon>
      <span>退货管理</span>
    </el-menu-item>
    <div class="menu-divider">系统管理</div>
    <el-menu-item index="/products">
      <el-icon><Goods /></el-icon>
      <span>商品管理</span>
    </el-menu-item>
    <el-menu-item v-if="auth.user?.role === 'admin'" index="/users">
      <el-icon><User /></el-icon>
      <span>账号管理</span>
    </el-menu-item>
    <el-menu-item index="/print-settings">
      <el-icon><Printer /></el-icon>
      <span>打印设置</span>
    </el-menu-item>
    <el-menu-item v-if="auth.user?.role === 'admin'" index="/settings">
      <el-icon><Setting /></el-icon>
      <span>系统名称</span>
    </el-menu-item>
    <el-menu-item v-if="auth.user?.role === 'admin'" index="/audit-logs">
      <el-icon><Document /></el-icon>
      <span>操作日志</span>
    </el-menu-item>
    <el-menu-item v-if="auth.user?.role === 'admin'" index="/backups">
      <el-icon><Files /></el-icon>
      <span>备份恢复</span>
    </el-menu-item>
    <el-menu-item v-if="auth.user?.role === 'admin'" index="/upgrade">
      <el-icon><UploadFilled /></el-icon>
      <span>系统升级</span>
    </el-menu-item>
    <el-menu-item index="/license">
      <el-icon><Key /></el-icon>
      <span>授权信息</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { auth } from '../stores/auth';

defineEmits(['select']);

const route = useRoute();

const active = computed(() => {
  const path = route.path;
  if (path.startsWith('/repairs')) return '/repairs';
  if (path.startsWith('/returns')) return '/returns';
  if (path.startsWith('/products')) return '/products';
  if (path.startsWith('/settings')) return '/settings';
  if (path.startsWith('/print-settings')) return '/print-settings';
  if (path.startsWith('/users')) return '/users';
  if (path.startsWith('/backups')) return '/backups';
  if (path.startsWith('/upgrade')) return '/upgrade';
  if (path.startsWith('/license')) return '/license';
  if (path.startsWith('/audit-logs')) return '/audit-logs';
  return '/';
});
</script>
