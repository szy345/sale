<template>
  <div class="auth-page">
    <div class="auth-decoration auth-decoration-one"></div>
    <div class="auth-decoration auth-decoration-two"></div>

    <div class="auth-card">
      <div class="auth-brand">
        <div class="auth-logo">{{ brandMark }}</div>
        <div>
          <h1>修改密码</h1>
          <p>{{ settings.systemName }} · {{ auth.user?.display_name }} · {{ roleLabel(auth.user?.role) }}</p>
        </div>
      </div>

      <el-alert
        v-if="auth.user?.must_change_password"
        title="这是初始密码，请先设置新密码后才能继续使用系统。"
        type="warning"
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
        <el-form-item label="原密码" prop="old_password">
          <el-input
            v-model="form.old_password"
            type="password"
            show-password
            autocomplete="current-password"
          />
        </el-form-item>
        <el-form-item label="新密码" prop="new_password">
          <el-input
            v-model="form.new_password"
            type="password"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirm_password">
          <el-input
            v-model="form.confirm_password"
            type="password"
            show-password
            autocomplete="new-password"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-button class="auth-submit" type="primary" :loading="loading" @click="submit">
          保存新密码
        </el-button>
      </el-form>

      <div class="auth-footer">
        <el-button link @click="handleLogout">退出登录</el-button>
        <span>修改后其他设备的登录状态将失效</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { errorMessage } from '../api';
import { auth, changePassword, logout } from '../stores/auth';
import { settings } from '../stores/settings';
import { roleLabel } from '../utils/format';

const router = useRouter();
const brandMark = computed(() => (settings.systemName || '系统').slice(0, 2));
const formRef = ref();
const loading = ref(false);

const form = reactive({
  old_password: '',
  new_password: '',
  confirm_password: '',
});

const rules = {
  old_password: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  new_password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, message: '新密码至少 8 个字符', trigger: 'blur' },
  ],
  confirm_password: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== form.new_password) callback(new Error('两次输入的密码不一致'));
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
    await changePassword({
      old_password: form.old_password,
      new_password: form.new_password,
    });
    ElMessage.success('密码修改成功');
    router.replace('/');
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

async function handleLogout() {
  await logout();
  router.replace('/login');
}
</script>
