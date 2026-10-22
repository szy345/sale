<template>
  <div class="auth-page">
    <div class="auth-decoration auth-decoration-one"></div>
    <div class="auth-decoration auth-decoration-two"></div>

    <div class="auth-card setup-card">
      <div class="auth-brand">
        <div class="auth-logo">{{ brandMark }}</div>
        <div>
          <h1>系统初始化</h1>
          <p>{{ settings.systemName }}销售维保系统 · 创建第一个管理员账号</p>
        </div>
      </div>

      <el-alert
        title="此页面只在系统首次使用时出现。请妥善保管管理员账号和密码。"
        type="info"
        :closable="false"
        show-icon
        class="setup-alert"
      />

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        size="large"
        @submit.prevent="submit"
      >
        <el-form-item label="管理员账号" prop="username">
          <el-input v-model="form.username" placeholder="字母、数字、下划线" autocomplete="username" />
        </el-form-item>
        <el-form-item label="管理员姓名" prop="display_name">
          <el-input v-model="form.display_name" placeholder="例如：店长" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirm_password">
          <el-input
            v-model="form.confirm_password"
            type="password"
            show-password
            autocomplete="new-password"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-button class="auth-submit" type="primary" :loading="loading" @click="submit">
          创建管理员并进入系统
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { errorMessage } from '../api';
import { setupAdmin } from '../stores/auth';
import { settings } from '../stores/settings';

const router = useRouter();
const brandMark = computed(() => (settings.systemName || '系统').slice(0, 2));
const formRef = ref();
const loading = ref(false);

const form = reactive({
  username: '',
  display_name: '',
  password: '',
  confirm_password: '',
});

const rules = {
  username: [
    { required: true, message: '请输入管理员账号', trigger: 'blur' },
    { min: 3, max: 32, message: '账号长度为 3-32 个字符', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z0-9_.-]+$/,
      message: '只能包含字母、数字、下划线、点和横线',
      trigger: 'blur',
    },
  ],
  display_name: [{ required: true, message: '请输入管理员姓名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码至少 8 个字符', trigger: 'blur' },
  ],
  confirm_password: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== form.password) callback(new Error('两次输入的密码不一致'));
        else callback();
      },
      trigger: 'blur',
    },
  ],
};

async function submit() {
  if (loading.value) return;
  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  loading.value = true;
  try {
    await setupAdmin({
      username: form.username,
      display_name: form.display_name,
      password: form.password,
    });
    ElMessage.success('管理员创建成功');
    router.replace('/');
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}
</script>
