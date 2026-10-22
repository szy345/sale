<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>授权信息</h2>
        <p>查看试用/正式授权状态，导入厂商签发的授权文件</p>
      </div>
      <div class="page-actions">
        <el-button :loading="loading" @click="load">
          <el-icon><Refresh /></el-icon>刷新状态
        </el-button>
      </div>
    </div>

    <el-skeleton :loading="loading" animated :rows="5">
      <template #default>
        <div class="license-hero" :class="heroClass">
          <div class="license-hero-icon">
            <el-icon :size="28">
              <CircleCheckFilled v-if="statusInfo.allowed" />
              <WarningFilled v-else />
            </el-icon>
          </div>
          <div class="license-hero-body">
            <div class="license-status-label">{{ statusInfo.label }}</div>
            <h3>{{ statusInfo.headline }}</h3>
            <p>{{ statusInfo.message }}</p>
            <div v-if="status?.status === 'trial'" class="license-hero-meta">
              试用开始：{{ formatDateTime(status.trial_started_at) }} ·
              到期：{{ formatDateTime(status.expires_at) }}
            </div>
            <div v-if="status?.status === 'licensed'" class="license-hero-meta">
              授权商户：{{ status.merchant || '—' }} ·
              {{ status.expires_at ? `到期：${status.expires_at}` : '永久有效' }}
            </div>
          </div>
          <div v-if="status?.status === 'trial'" class="license-days">
            <strong>{{ status.days_remaining }}</strong>
            <span>剩余天数</span>
          </div>
          <div v-else-if="status?.status === 'licensed'" class="license-days license-days-ok">
            <el-icon :size="30"><CircleCheckFilled /></el-icon>
            <span>正式授权</span>
          </div>
        </div>

        <div class="license-grid">
          <div class="panel panel-pad">
            <div class="license-section-title">设备信息</div>
            <div class="license-machine">{{ status?.machine_code || '—' }}</div>
            <div class="muted small machine-hint">
              将此机器码发给厂商生成正式授权文件
            </div>
            <el-button class="copy-button" @click="copyMachineCode">
              <el-icon><CopyDocument /></el-icon>复制机器码
            </el-button>
            <div class="license-divider"></div>
            <div class="license-info-list">
              <div><span>系统版本</span><strong>{{ settings.version }}</strong></div>
              <div><span>授权类型</span><strong>{{ typeLabel }}</strong></div>
              <div><span>授权编号</span><strong>{{ status?.license_id || '—' }}</strong></div>
              <div><span>到期时间</span><strong>{{ expiryLabel }}</strong></div>
            </div>
          </div>

          <div class="panel panel-pad">
            <div class="license-section-title">导入授权文件</div>
            <template v-if="isAdmin">
              <div class="import-box">
                <el-icon :size="38"><UploadFilled /></el-icon>
                <p>选择厂商提供的 <strong>.lic</strong> 授权文件</p>
                <input
                  ref="fileInput"
                  type="file"
                  accept=".lic,.json,application/json"
                  class="file-input"
                  @change="handleFile"
                />
                <el-button type="primary" :loading="importing" @click="fileInput?.click()">
                  选择授权文件
                </el-button>
              </div>
              <div class="muted small import-hint">
                导入成功后立即生效，不需要重启系统。请确认文件来自可信厂商。
              </div>
            </template>
            <el-alert
              v-else
              title="如需导入或更新授权，请联系系统管理员。"
              type="info"
              :closable="false"
              show-icon
            />
            <div class="license-divider"></div>
            <div class="muted small">
              当前授权状态为“{{ statusInfo.label }}”。业务功能{{ statusInfo.allowed ? '可正常使用' : '已锁定' }}，
              备份恢复和系统升级不受影响。
            </div>
            <div v-if="!statusInfo.allowed" class="locked-actions">
              <el-button @click="router.push('/backups')">前往备份恢复</el-button>
              <el-button v-if="isAdmin" @click="router.push('/upgrade')">系统升级</el-button>
            </div>
          </div>
        </div>
      </template>
    </el-skeleton>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { errorMessage } from '../api';
import { auth } from '../stores/auth';
import { importLicense, license, loadLicenseStatus } from '../stores/license';
import { settings } from '../stores/settings';
import { formatDateTime } from '../utils/format';

const router = useRouter();
const loading = ref(false);
const importing = ref(false);
const fileInput = ref(null);

const status = computed(() => license.status);
const isAdmin = computed(() => auth.user?.role === 'admin');

const statusInfo = computed(() => {
  const current = status.value;
  switch (current?.status) {
    case 'licensed':
      return {
        allowed: true,
        label: '已授权',
        headline: '系统已获得正式授权',
        message: '所有业务功能可正常使用。',
      };
    case 'trial':
      return {
        allowed: true,
        label: '试用中',
        headline: `试用期剩余 ${current.days_remaining ?? 0} 天`,
        message:
          current.days_remaining <= 7
            ? '试用期即将结束，请及时导入正式授权，避免影响正常营业。'
            : '试用期内可使用全部业务功能。',
      };
    case 'expired':
      return {
        allowed: false,
        label: '已到期',
        headline: '授权已到期',
        message: current.message || '请导入新的授权文件后继续使用。',
      };
    case 'unlicensed':
      return {
        allowed: false,
        label: '未授权',
        headline: '当前系统尚未授权',
        message: '请导入正式授权文件后继续使用。',
      };
    case 'machine_mismatch':
      return {
        allowed: false,
        label: '机器码不匹配',
        headline: '授权与当前电脑不匹配',
        message: '请联系厂商重新签发当前机器码的授权文件。',
      };
    case 'tampered':
      return {
        allowed: false,
        label: '授权异常',
        headline: '检测到授权或系统时间异常',
        message: '请检查系统时间并导入正式授权文件。',
      };
    case 'invalid_license':
      return {
        allowed: false,
        label: '授权文件无效',
        headline: '授权文件验证失败',
        message: current.message || '请重新导入有效的授权文件。',
      };
    default:
      return {
        allowed: false,
        label: '未知',
        headline: '正在获取授权状态',
        message: '如果长时间无法获取，请刷新页面。',
      };
  }
});

const heroClass = computed(() => {
  if (!statusInfo.value.allowed) return 'license-hero-bad';
  return status.value?.status === 'trial' ? 'license-hero-trial' : 'license-hero-ok';
});

const typeLabel = computed(() => {
  if (status.value?.type === 'trial') return '试用授权';
  if (status.value?.type === 'paid') return '正式授权';
  return '—';
});

const expiryLabel = computed(() => {
  const value = status.value?.expires_at;
  if (!value) return status.value?.status === 'licensed' ? '永久有效' : '—';
  if (String(value).includes('T')) return formatDateTime(value);
  return value;
});

async function load() {
  loading.value = true;
  try {
    await loadLicenseStatus(true);
  } finally {
    loading.value = false;
  }
}

async function copyMachineCode() {
  const code = status.value?.machine_code;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    ElMessage.success('机器码已复制');
  } catch {
    ElMessage.warning(`请手动复制机器码：${code}`);
  }
}

function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error || new Error('读取授权文件失败'));
    reader.readAsDataURL(file);
  });
}

async function handleFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 150 * 1024) {
    ElMessage.warning('授权文件过大，请确认文件是否正确');
    event.target.value = '';
    return;
  }

  importing.value = true;
  try {
    const contentBase64 = await readFileBase64(file);
    const result = await importLicense(contentBase64);
    if (result.allowed) {
      ElMessage.success('授权导入成功，业务功能已恢复');
      router.push('/');
    } else {
      ElMessage.warning(result.message || '授权文件已导入，但当前状态未恢复');
      await load();
    }
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    importing.value = false;
    event.target.value = '';
  }
}

onMounted(load);
</script>

<style scoped>
.license-hero {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 24px;
  margin-bottom: 18px;
  border: 1px solid var(--yk-border);
  border-radius: 16px;
  background: #fff;
}

.license-hero-ok {
  border-color: #bbf7d0;
  background: linear-gradient(135deg, #f0fdf4, #ffffff);
}

.license-hero-trial {
  border-color: #fde68a;
  background: linear-gradient(135deg, #fffbeb, #ffffff);
}

.license-hero-bad {
  border-color: #fecdd3;
  background: linear-gradient(135deg, #fff1f2, #ffffff);
}

.license-hero-icon {
  width: 62px;
  height: 62px;
  flex: 0 0 62px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  background: #fff;
  color: var(--yk-red);
  box-shadow: 0 6px 18px rgba(34, 39, 51, 0.06);
}

.license-hero-ok .license-hero-icon {
  color: #15803d;
}

.license-hero-trial .license-hero-icon {
  color: #d97706;
}

.license-hero-body {
  flex: 1;
  min-width: 0;
}

.license-status-label {
  font-size: 11px;
  color: var(--yk-muted);
  letter-spacing: 1px;
}

.license-hero h3 {
  margin: 5px 0 4px;
  font-size: 21px;
  color: var(--yk-text);
}

.license-hero p {
  margin: 0;
  color: #60656e;
  font-size: 13px;
}

.license-hero-meta {
  margin-top: 8px;
  color: var(--yk-muted);
  font-size: 12px;
}

.license-days {
  flex: 0 0 auto;
  min-width: 92px;
  text-align: center;
  color: #b45309;
}

.license-days strong {
  display: block;
  font-size: 36px;
  line-height: 1;
}

.license-days span {
  display: block;
  margin-top: 4px;
  font-size: 11px;
}

.license-days-ok {
  color: #15803d;
}

.license-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.license-section-title {
  margin-bottom: 14px;
  padding-left: 9px;
  border-left: 3px solid var(--yk-red);
  font-size: 14px;
  font-weight: 700;
}

.license-machine {
  padding: 14px 16px;
  border: 1px dashed #d8b4fe;
  border-radius: 10px;
  background: #faf5ff;
  color: #6d28d9;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 1px;
  text-align: center;
  word-break: break-all;
}

.machine-hint {
  margin-top: 8px;
  text-align: center;
}

.copy-button {
  margin-top: 12px;
  width: 100%;
}

.license-divider {
  height: 1px;
  margin: 18px 0;
  background: var(--yk-border);
}

.license-info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.license-info-list > div {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  font-size: 13px;
}

.license-info-list span {
  color: var(--yk-muted);
}

.license-info-list strong {
  font-weight: 600;
  color: #3b3f46;
  word-break: break-all;
  text-align: right;
}

.import-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 16px;
  border: 1px dashed var(--yk-border);
  border-radius: 12px;
  background: #fafbfc;
  color: var(--yk-muted);
  text-align: center;
}

.import-box p {
  margin: 0;
  font-size: 13px;
}

.file-input {
  display: none;
}

.import-hint {
  margin-top: 10px;
  line-height: 1.6;
}

.locked-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
}

@media (max-width: 900px) {
  .license-grid {
    grid-template-columns: 1fr;
  }

  .license-hero {
    flex-wrap: wrap;
  }

  .license-days {
    margin-left: auto;
  }

  .license-machine {
    font-size: 18px;
  }
}
</style>
