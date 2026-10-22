<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>备份恢复</h2>
        <p>备份数据库文件，防止误删、升级或设备故障造成数据丢失</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" :loading="backingUp" @click="backupNow">
          <el-icon><Files /></el-icon>立即备份
        </el-button>
      </div>
    </div>

    <el-alert
      title="自动备份默认每天 02:00 执行。服务器到点时未运行，会在下次启动后补做当天备份。自动清理只针对“自动备份”文件，手动备份和升级备份不会自动删除。"
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    />

    <div class="panel panel-pad backup-settings-panel">
      <div class="backup-settings-head">
        <div>
          <h3>自动备份设置</h3>
          <p class="muted small">
            最近自动备份：{{ lastAutoAt ? formatDateTime(lastAutoAt) : '尚未执行' }}
          </p>
        </div>
        <span v-if="backupDir" class="muted small backup-path">目录：{{ backupDir }}</span>
      </div>

      <el-form :inline="true" label-position="top" @submit.prevent="saveSettings">
        <el-form-item label="启用自动备份">
          <el-switch v-model="settingsForm.enabled" active-text="启用" inactive-text="停用" />
        </el-form-item>
        <el-form-item label="每天备份时间">
          <el-time-picker
            v-model="settingsForm.time"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="选择时间"
            :disabled="!settingsForm.enabled"
            style="width: 150px"
          />
        </el-form-item>
        <el-form-item label="自动备份保留份数">
          <el-input-number
            v-model="settingsForm.retention"
            :min="1"
            :max="365"
            controls-position="right"
            :disabled="!settingsForm.enabled"
            style="width: 130px"
          />
        </el-form-item>
        <el-form-item label=" ">
          <el-button type="primary" :loading="saving" @click="saveSettings">保存设置</el-button>
        </el-form-item>
      </el-form>

      <div class="muted small">
        备份文件保存在服务器 data/backups 目录。建议定期将备份目录复制到移动硬盘或 NAS，防止服务器硬盘损坏。
      </div>
    </div>

    <div class="panel table-panel">
      <div class="table-toolbar">
        <span class="total">共 <strong>{{ files.length }}</strong> 个备份文件</span>
        <el-button text :loading="loading" @click="load">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>

      <el-table v-loading="loading" :data="files" style="width: 100%" row-key="name">
        <el-table-column prop="name" label="备份文件" min-width="250" show-overflow-tooltip />
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <el-tag :type="typeTag(row.type)" effect="plain" round>{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="大小" width="110" align="right">
          <template #default="{ row }">{{ formatSize(row.size) }}</template>
        </el-table-column>
        <el-table-column label="备份时间" min-width="160">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <el-button link type="warning" @click="openRestore(row)">恢复</el-button>
            <el-button link type="primary" @click="download(row)">下载</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无备份文件" :image-size="90" />
        </template>
      </el-table>
    </div>

    <el-dialog
      v-model="restoreDialogVisible"
      title="确认恢复数据"
      width="min(520px, 92vw)"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div class="restore-confirm">
        <div class="restore-confirm-head">
          <div class="restore-warning-icon">
            <el-icon :size="24"><WarningFilled /></el-icon>
          </div>
          <div class="restore-confirm-heading">
            <div class="restore-confirm-title">请确认要恢复此备份</div>
            <div class="restore-file">{{ restoreTarget?.name || '' }}</div>
          </div>
        </div>

        <ol class="restore-steps">
          <li>
            <span class="step-num">1</span>
            <span>恢复该备份，会覆盖当前所有数据。</span>
          </li>
          <li>
            <span class="step-num">2</span>
            <span>系统自动备份当前系统数据。</span>
          </li>
          <li>
            <span class="step-num">3</span>
            <span>重启服务。</span>
          </li>
          <li>
            <span class="step-num">4</span>
            <span>恢复期间，所有用户无法使用。</span>
          </li>
        </ol>

        <p class="restore-question">确定继续吗？</p>
      </div>
      <template #footer>
        <el-button @click="restoreDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="restoring" @click="confirmRestore">
          确定恢复
        </el-button>
      </template>
    </el-dialog>

    <div v-if="restoring" class="restore-overlay">
      <div class="restore-box">
        <el-icon class="is-loading" :size="30"><Loading /></el-icon>
        <h3>正在恢复数据并重启服务</h3>
        <p>系统会先自动备份当前数据，然后替换为所选备份。请勿关闭页面，完成后会自动刷新。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { errorMessage } from '../api';
import { formatDateTime } from '../utils/format';

const loading = ref(false);
const backingUp = ref(false);
const saving = ref(false);
const restoring = ref(false);
const restoreDialogVisible = ref(false);
const restoreTarget = ref(null);
const files = ref([]);
const lastAutoAt = ref(null);
const backupDir = ref('');
const settingsForm = reactive({
  enabled: true,
  time: '02:00',
  retention: 30,
});

function typeLabel(type) {
  if (type === 'auto') return '自动备份';
  if (type === 'manual') return '手动备份';
  return '升级备份';
}

function typeTag(type) {
  if (type === 'auto') return 'success';
  if (type === 'manual') return 'primary';
  return 'info';
}

function formatSize(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get('/backups');
    files.value = data.files || [];
    lastAutoAt.value = data.lastAutoAt;
    backupDir.value = data.backupDir || '';
    Object.assign(settingsForm, data.settings || {});
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

async function backupNow() {
  backingUp.value = true;
  try {
    const { data } = await api.post('/backups');
    ElMessage.success(`备份已创建：${data.name}`);
    await load();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    backingUp.value = false;
  }
}

async function saveSettings() {
  saving.value = true;
  try {
    await api.patch('/backups/settings', {
      enabled: settingsForm.enabled,
      time: settingsForm.time,
      retention: settingsForm.retention,
    });
    ElMessage.success('自动备份设置已保存');
    await load();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

function download(row) {
  const link = document.createElement('a');
  link.href = `/api/backups/${encodeURIComponent(row.name)}/download`;
  link.download = row.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function waitForRestart() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      if (response.ok) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        window.location.reload();
        return;
      }
    } catch {
      // Wait for the server process to come back.
    }
  }
  restoring.value = false;
  ElMessage.warning('恢复已执行，但服务未在预期时间内启动，请手动刷新或检查服务器日志');
}

function openRestore(row) {
  restoreTarget.value = row;
  restoreDialogVisible.value = true;
}

async function confirmRestore() {
  const row = restoreTarget.value;
  if (!row) return;

  restoreDialogVisible.value = false;
  restoring.value = true;
  try {
    const { data } = await api.post(`/backups/${encodeURIComponent(row.name)}/restore`);
    ElMessage.success(`恢复已开始，当前数据已备份为 ${data.safetyBackup}`);
    await waitForRestart();
  } catch (error) {
    restoring.value = false;
    ElMessage.error(errorMessage(error));
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除备份文件“${row.name}”吗？删除后无法恢复。`,
      '删除备份',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }

  try {
    await api.delete(`/backups/${encodeURIComponent(row.name)}`);
    ElMessage.success('备份文件已删除');
    await load();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}

onMounted(load);
</script>

<style scoped>
.backup-settings-panel {
  margin-bottom: 16px;
}

.backup-settings-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 4px;
}

.backup-settings-head h3 {
  margin: 0;
  font-size: 15px;
}

.backup-settings-head p {
  margin: 5px 0 0;
}

.backup-path {
  max-width: 50%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.restore-confirm {
  padding-top: 2px;
}

.restore-confirm-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}

.restore-warning-icon {
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: #fff1f2;
  color: #e60012;
}

.restore-confirm-heading {
  min-width: 0;
}

.restore-confirm-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--yk-text);
}

.restore-file {
  margin-top: 5px;
  font-size: 12px;
  color: var(--yk-muted);
  word-break: break-all;
}

.restore-steps {
  list-style: none;
  margin: 0;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #fafbfc;
  border: 1px solid #eceef2;
  border-radius: 12px;
}

.restore-steps li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  line-height: 1.6;
  color: #4b5058;
}

.step-num {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid #f0c2c9;
  background: #fff;
  color: #c8102e;
  font-size: 12px;
  font-weight: 700;
}

.restore-question {
  margin: 18px 0 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--yk-text);
}

.restore-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(20, 22, 28, 0.55);
  backdrop-filter: blur(2px);
}

.restore-box {
  width: min(460px, 100%);
  padding: 28px;
  border-radius: 16px;
  background: #fff;
  text-align: center;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.2);
}

.restore-box h3 {
  margin: 14px 0 8px;
}

.restore-box p {
  margin: 0;
  color: var(--yk-muted);
  font-size: 13px;
  line-height: 1.7;
}
</style>
