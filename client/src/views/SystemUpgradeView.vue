<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>系统升级</h2>
        <p>从新目录启动新版本，旧系统目录和数据保持不动，失败自动回滚</p>
      </div>
    </div>

    <div v-if="lastResult" class="upgrade-result" :class="`result-${lastResult.status}`">
      <div class="result-icon">
        <el-icon :size="22">
          <CircleCheckFilled v-if="lastResult.status === 'success'" />
          <WarningFilled v-else />
        </el-icon>
      </div>
      <div class="result-body">
        <strong>{{ lastResult.status === 'success' ? '上次升级成功' : '上次升级失败，已回滚' }}</strong>
        <p v-if="lastResult.status === 'success'">
          {{ lastResult.oldVersion }} → {{ lastResult.newVersion }} · 当前运行：
          {{ lastResult.newRoot }}
        </p>
        <p v-else>{{ lastResult.reason || '新系统启动失败' }}</p>
        <p class="small">
          开机自启：{{ serviceLabel(lastResult.serviceUpdated) }}
          <template v-if="lastResult.finishedAt"> · {{ formatDateTime(lastResult.finishedAt) }}</template>
        </p>
        <p v-if="lastResult.logFile" class="small muted">升级日志：{{ lastResult.logFile }}</p>
      </div>
    </div>

    <div class="upgrade-grid">
      <div class="panel panel-pad">
        <div class="upgrade-section-title">当前系统</div>
        <div class="info-list">
          <div><span>当前版本</span><strong>{{ info.currentVersion || '—' }}</strong></div>
          <div><span>Node.js</span><strong>{{ info.nodeVersion || '—' }}</strong></div>
          <div><span>运行目录</span><strong class="path-value">{{ info.currentRoot || '—' }}</strong></div>
          <div><span>数据目录</span><strong class="path-value">{{ info.dataDir || '—' }}</strong></div>
        </div>
      </div>

      <div class="panel panel-pad">
        <div class="upgrade-section-title">新系统目录</div>
        <el-form label-position="top" @submit.prevent="checkPath">
          <el-form-item label="新版本解压后的完整路径（服务器本机绝对路径）">
            <el-input
              v-model="newPath"
              placeholder="例如：D:\yearcon-sale-v1.1"
              :disabled="upgrading"
              @keyup.enter="checkPath"
            />
            <div class="field-hint">
              先把新版本完整解压到一个全新目录，不要覆盖当前目录；新目录中的 data 必须为空。
            </div>
          </el-form-item>
          <div class="form-actions">
            <el-button :loading="validating" :disabled="upgrading" @click="checkPath">
              <el-icon><Search /></el-icon>检查新系统
            </el-button>
            <el-button
              type="primary"
              :disabled="!validation?.valid || upgrading"
              @click="confirmVisible = true"
            >
              <el-icon><UploadFilled /></el-icon>开始升级
            </el-button>
          </div>
        </el-form>
      </div>
    </div>

    <div v-if="validation" class="panel panel-pad validation-panel">
      <div class="upgrade-section-title">检查结果</div>
      <div class="check-summary" :class="{ 'check-ok': validation.valid, 'check-bad': !validation.valid }">
        <el-icon :size="20">
          <CircleCheckFilled v-if="validation.valid" />
          <WarningFilled v-else />
        </el-icon>
        <strong>{{ validation.valid ? '新系统检查通过，可以升级' : '新系统检查未通过' }}</strong>
      </div>

      <div class="check-grid">
        <div><span>当前版本</span><strong>{{ validation.currentVersion }}</strong></div>
        <div><span>新版本</span><strong>{{ validation.newVersion || '—' }}</strong></div>
        <div><span>Node.js</span><strong>{{ validation.nodeVersion || '—' }}</strong></div>
        <div><span>新 data 目录</span><strong>{{ validation.dataEmpty ? '空，可升级' : '非空，不可升级' }}</strong></div>
        <div class="full"><span>新系统目录</span><strong class="path-value">{{ validation.newRoot || '—' }}</strong></div>
      </div>

      <div v-if="validation.errors?.length" class="check-errors">
        <div v-for="(item, index) in validation.errors" :key="index">{{ item }}</div>
      </div>
      <div v-if="validation.warnings?.length" class="check-warnings">
        <div v-for="(item, index) in validation.warnings" :key="index">{{ item }}</div>
      </div>
    </div>

    <el-alert
      title="升级会把当前 data 和 config.json 复制到新目录，然后停止旧系统并启动新系统。旧目录不会被修改，可保留用于回滚。升级期间所有用户无法使用。"
      type="warning"
      :closable="false"
      show-icon
      class="upgrade-alert"
    />

    <el-dialog
      v-model="confirmVisible"
      title="确认系统升级"
      width="min(560px, 92vw)"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div class="upgrade-confirm">
        <div class="confirm-head">
          <div class="confirm-icon"><el-icon :size="24"><WarningFilled /></el-icon></div>
          <div>
            <div class="confirm-title">请确认升级到新版本</div>
            <div class="confirm-path">{{ validation?.newRoot }}</div>
          </div>
        </div>
        <ol class="confirm-steps">
          <li><span>1</span>把当前系统的 data 和 config.json 复制到新目录。</li>
          <li><span>2</span>停止当前系统服务。</li>
          <li><span>3</span>从新目录启动新系统。</li>
          <li><span>4</span>升级期间所有用户无法使用。</li>
          <li><span>5</span>新系统启动失败会自动恢复旧系统。</li>
        </ol>
        <p class="confirm-question">确定继续吗？</p>
      </div>
      <template #footer>
        <el-button :disabled="upgrading" @click="confirmVisible = false">取消</el-button>
        <el-button type="danger" :loading="upgrading" @click="startUpgrade">确定升级</el-button>
      </template>
    </el-dialog>

    <div v-if="upgrading" class="upgrade-overlay">
      <div class="upgrade-overlay-box">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <h3>正在升级系统</h3>
        <p>正在复制数据、停止旧系统并启动新版本。请勿关闭页面，系统恢复后会自动刷新。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import api, { errorMessage } from '../api';
import { formatDateTime } from '../utils/format';

const loading = ref(false);
const validating = ref(false);
const upgrading = ref(false);
const confirmVisible = ref(false);
const newPath = ref('');
const info = ref({});
const validation = ref(null);

const lastResult = computed(() => info.value.lastResult || null);

function serviceLabel(value) {
  if (value === 'updated') return '已更新';
  if (value === 'not-installed') return '未安装开机任务';
  if (value === 'failed') return '更新失败，请手动检查开机任务';
  if (value === 'not-supported') return '当前系统不支持自动更新';
  if (value === 'unchanged') return '保持原样';
  return '未知';
}

async function loadInfo() {
  loading.value = true;
  try {
    const { data } = await api.get('/upgrade/info');
    info.value = data;
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

async function checkPath() {
  if (!newPath.value.trim()) {
    ElMessage.warning('请输入新系统目录');
    return;
  }

  validating.value = true;
  validation.value = null;
  try {
    const { data } = await api.post('/upgrade/validate', {
      new_path: newPath.value.trim(),
    });
    validation.value = data;
    if (data.valid) ElMessage.success('新系统检查通过');
    else ElMessage.warning('新系统检查未通过，请查看原因');
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    validating.value = false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRestart() {
  await sleep(3000);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      if (response.ok) {
        await sleep(1500);
        window.location.reload();
        return;
      }
    } catch {
      // The old server may be stopped while the helper starts the new one.
    }
    await sleep(1500);
  }
  upgrading.value = false;
  ElMessage.error('系统未在预期时间内恢复，请检查升级日志或手动启动系统');
}

async function startUpgrade() {
  if (!validation.value?.valid) return;

  confirmVisible.value = false;
  upgrading.value = true;
  try {
    await api.post('/upgrade', { new_path: validation.value.newRoot });
  } catch (error) {
    if (error.response) {
      upgrading.value = false;
      ElMessage.error(errorMessage(error));
      return;
    }
    // No response usually means the old service has already exited.
  }
  await waitForRestart();
}

onMounted(loadInfo);
</script>

<style scoped>
.upgrade-result {
  display: flex;
  gap: 14px;
  padding: 16px 18px;
  margin-bottom: 16px;
  border: 1px solid var(--yk-border);
  border-radius: 12px;
  background: #fff;
}

.result-success {
  border-color: #bbf7d0;
  background: #f4fdf7;
}

.result-failed {
  border-color: #fecdd3;
  background: #fff7f8;
}

.result-icon {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: #fff;
  color: var(--yk-red);
}

.result-success .result-icon {
  color: #15803d;
}

.result-body {
  min-width: 0;
}

.result-body strong {
  font-size: 15px;
}

.result-body p {
  margin: 5px 0 0;
  color: #555b66;
  font-size: 13px;
  word-break: break-word;
}

.upgrade-grid {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 16px;
}

.upgrade-section-title {
  margin-bottom: 14px;
  padding-left: 9px;
  border-left: 3px solid var(--yk-red);
  font-size: 14px;
  font-weight: 700;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-list > div,
.check-grid > div {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  font-size: 13px;
}

.info-list span,
.check-grid span {
  flex: 0 0 auto;
  color: var(--yk-muted);
}

.info-list strong,
.check-grid strong {
  min-width: 0;
  color: #3b3f46;
  font-weight: 600;
  text-align: right;
}

.path-value {
  word-break: break-all;
}

.field-hint {
  margin-top: 5px;
  color: var(--yk-muted);
  font-size: 11px;
  line-height: 1.6;
}

.validation-panel {
  margin-top: 16px;
}

.check-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}

.check-ok {
  color: #15803d;
}

.check-bad {
  color: #e60012;
}

.check-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 20px;
}

.check-grid .full {
  grid-column: 1 / -1;
}

.check-errors {
  margin-top: 15px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #fff1f2;
  color: #b91c1c;
  font-size: 13px;
  line-height: 1.8;
}

.check-warnings {
  margin-top: 10px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #fffbeb;
  color: #b45309;
  font-size: 13px;
  line-height: 1.8;
}

.upgrade-alert {
  margin-top: 16px;
}

.upgrade-confirm {
  padding-top: 2px;
}

.confirm-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}

.confirm-icon {
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: #fff1f2;
  color: #e60012;
}

.confirm-title {
  font-size: 16px;
  font-weight: 700;
}

.confirm-path {
  margin-top: 5px;
  color: var(--yk-muted);
  font-size: 12px;
  word-break: break-all;
}

.confirm-steps {
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

.confirm-steps li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  line-height: 1.6;
  color: #4b5058;
}

.confirm-steps li span {
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

.confirm-question {
  margin: 18px 0 0;
  font-size: 14px;
  font-weight: 700;
}

.upgrade-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(20, 22, 28, 0.55);
  backdrop-filter: blur(2px);
}

.upgrade-overlay-box {
  width: min(480px, 100%);
  padding: 30px;
  border-radius: 16px;
  background: #fff;
  text-align: center;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.2);
}

.upgrade-overlay-box h3 {
  margin: 14px 0 8px;
}

.upgrade-overlay-box p {
  margin: 0;
  color: var(--yk-muted);
  font-size: 13px;
  line-height: 1.7;
}

@media (max-width: 900px) {
  .upgrade-grid {
    grid-template-columns: 1fr;
  }

  .check-grid {
    grid-template-columns: 1fr;
  }

  .check-grid .full {
    grid-column: auto;
  }
}
</style>
