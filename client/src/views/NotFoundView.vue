<template>
  <div class="not-found">
    <div class="not-found-code">404</div>
    <h1>页面不存在</h1>
    <p>您访问的页面可能已被移除或地址有误。</p>
    <el-button type="primary" @click="router.replace('/')">返回首页</el-button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();
</script>
