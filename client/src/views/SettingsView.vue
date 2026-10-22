<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>系统名称</h2>
        <p>管理系统的显示名称，保存后侧边栏、登录页、浏览器标题和打印凭证都会同步更新</p>
      </div>
    </div>

    <div class="panel panel-pad" style="max-width: 720px">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="系统名称" prop="system_name">
          <el-input v-model="form.system_name" maxlength="50" placeholder="例如：意尔康" />
          <div class="muted small setting-hint">
            例如设置为“意尔康”，系统标题显示为“意尔康销售维保系统”，打印凭证抬头也使用该名称。
          </div>
        </el-form-item>
        <div class="form-actions">
          <el-button type="primary" :loading="saving" @click="submit">保存系统名称</el-button>
          <el-button @click="reset">恢复当前值</el-button>
        </div>
      </el-form>

      <el-divider />
      <div class="setting-preview">
        <span class="muted small">当前显示效果</span>
        <div class="setting-preview-name">{{ settings.systemName }}销售维保系统</div>
        <div class="muted small">打印凭证抬头：{{ settings.systemName }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { appTitle, saveSystemName, settings } from '../stores/settings';

const formRef = ref();
const saving = ref(false);
const form = reactive({ system_name: settings.systemName });

const rules = {
  system_name: [
    { required: true, message: '请输入系统名称', trigger: 'blur' },
    { max: 50, message: '系统名称最多 50 个字符', trigger: 'blur' },
  ],
};

function reset() {
  form.system_name = settings.systemName;
}

async function submit() {
  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  saving.value = true;
  try {
    await saveSystemName(form.system_name);
    form.system_name = settings.systemName;
    document.title = `${document.title.split(' - ')[0]} - ${appTitle()}`;
    ElMessage.success('系统名称已保存');
  } catch (error) {
    ElMessage.error(error.response?.data?.message || error.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  form.system_name = settings.systemName;
});
</script>

<style scoped>
.setting-hint {
  margin-top: 5px;
}

.setting-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setting-preview-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--yk-red);
}

@media (max-width: 900px) {
  .panel {
    max-width: 100% !important;
  }
}
</style>
