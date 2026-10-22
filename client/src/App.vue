<template>
  <router-view />
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { auth } from './stores/auth';
import { loadLicenseStatus } from './stores/license';

const router = useRouter();

function handleExpired() {
  auth.user = null;
  if (router.currentRoute.value.path !== '/login') {
    router.replace({
      path: '/login',
      query: { redirect: router.currentRoute.value.fullPath },
    });
  }
}

function handlePasswordRequired() {
  if (router.currentRoute.value.path !== '/change-password') {
    router.replace('/change-password');
  }
}

async function handleLicenseRequired() {
  await loadLicenseStatus(true);
  if (router.currentRoute.value.path !== '/license') {
    router.replace('/license');
  }
}

onMounted(() => {
  window.addEventListener('auth-expired', handleExpired);
  window.addEventListener('password-change-required', handlePasswordRequired);
  window.addEventListener('license-required', handleLicenseRequired);
});

onUnmounted(() => {
  window.removeEventListener('auth-expired', handleExpired);
  window.removeEventListener('password-change-required', handlePasswordRequired);
  window.removeEventListener('license-required', handleLicenseRequired);
});
</script>
