<template>
  <div class="status-page">
    <div class="status-shell">
      <div class="status-brand">
        <div class="status-logo">{{ brandMark }}</div>
        <div>
          <h1>{{ systemName }}</h1>
          <p>维修进度查询</p>
        </div>
      </div>

      <div v-if="loading" class="status-card status-loading">
        <el-icon class="is-loading" :size="30"><Loading /></el-icon>
        <p>正在查询维修进度…</p>
      </div>

      <div v-else-if="error" class="status-card">
        <el-result icon="warning" title="未找到维修单" :sub-title="error">
          <template #extra>
            <el-button type="primary" @click="load">重新查询</el-button>
          </template>
        </el-result>
      </div>

      <template v-else-if="repair">
        <div class="status-card status-hero">
          <div class="status-hero-top">
            <div>
              <div class="status-ticket-label">维修单号</div>
              <div class="status-ticket">{{ repair.ticket_no }}</div>
            </div>
            <StatusTag :status="repair.status" />
          </div>
          <div class="status-current">
            <div class="status-current-label">当前状态</div>
            <div class="status-current-name">{{ REPAIR_STATUS_LABELS[repair.status] }}</div>
            <div class="status-current-meta">
              第 {{ repair.current_round }} 轮 · 维修日期 {{ repair.repair_date }}
            </div>
          </div>
        </div>

        <div class="status-card">
          <div class="status-section-title">维修信息</div>
          <div class="status-info-grid">
            <div class="status-info-item">
              <span>商品名称</span>
              <strong>{{ repair.product_name || '—' }}</strong>
            </div>
            <div class="status-info-item">
              <span>货号</span>
              <strong>{{ repair.item_no || '—' }}</strong>
            </div>
            <div class="status-info-item">
              <span>颜色 / 尺码</span>
              <strong>{{ [repair.color, repair.size].filter(Boolean).join(' / ') || '—' }}</strong>
            </div>
            <div class="status-info-item">
              <span>顾客</span>
              <strong>{{ repair.customer_name || '—' }}</strong>
            </div>
            <div class="status-info-item">
              <span>联系电话</span>
              <strong>{{ repair.phone || '—' }}</strong>
            </div>
          </div>
        </div>

        <div class="status-card">
          <div class="status-section-title">进度记录</div>
          <div class="status-timeline">
            <div v-for="(event, index) in timeline" :key="index" class="status-event">
              <span
                class="status-event-dot"
                :style="{ background: REPAIR_STATUS_COLORS[event.stage] || '#909399' }"
              ></span>
              <div class="status-event-body">
                <div class="status-event-title">
                  <span>{{ STAGE_LABELS[event.stage] || REPAIR_STATUS_LABELS[event.stage] || event.stage }}</span>
                  <span class="status-event-round">第 {{ event.round_no }} 轮</span>
                </div>
                <div class="status-event-date">{{ event.event_date }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="status-footer">
          <p v-if="shopPhone">如有疑问，请联系门店：{{ shopPhone }}</p>
          <p v-if="shopAddress">{{ shopAddress }}</p>
          <p class="status-privacy">本页面仅显示维修进度，顾客姓名和电话已做隐私处理。</p>
          <el-button text @click="load">刷新进度</el-button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import api, { errorMessage } from '../api';
import StatusTag from '../components/StatusTag.vue';
import {
  REPAIR_STATUS_COLORS,
  REPAIR_STATUS_LABELS,
  STAGE_LABELS,
} from '../constants';

const route = useRoute();
const loading = ref(true);
const error = ref('');
const data = ref(null);

const systemName = computed(() => data.value?.systemName || '销售维保系统');
const brandMark = computed(() => systemName.value.slice(0, 2));
const shopPhone = computed(() => data.value?.shopPhone || '');
const shopAddress = computed(() => data.value?.shopAddress || '');
const repair = computed(() => data.value?.repair || null);

const timeline = computed(() => {
  if (!repair.value) return [];
  const initial = {
    stage: 'pending_factory',
    round_no: 1,
    event_date: repair.value.repair_date,
    initial: true,
  };
  return [initial, ...(repair.value.events || [])];
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get(`/public/repairs/${encodeURIComponent(route.params.token)}`);
    data.value = response.data;
    document.title = `维修进度 - ${response.data.systemName}销售维保系统`;
  } catch (err) {
    data.value = null;
    error.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.status-page {
  min-height: 100vh;
  padding: 28px 16px 40px;
  background:
    radial-gradient(circle at 15% 10%, rgba(200, 16, 46, 0.14), transparent 30%),
    radial-gradient(circle at 85% 90%, rgba(125, 12, 30, 0.12), transparent 35%),
    linear-gradient(150deg, #f9f0f2, #f4f5f7 60%, #fbf1f3);
}

.status-shell {
  width: min(640px, 100%);
  margin: 0 auto;
}

.status-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
  padding: 0 4px;
}

.status-logo {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--yk-red), #e94a5f);
  color: #fff;
  font-weight: 800;
  font-size: 18px;
  box-shadow: 0 8px 20px rgba(200, 16, 46, 0.2);
}

.status-brand h1 {
  margin: 0;
  font-size: 19px;
  letter-spacing: 0.5px;
}

.status-brand p {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--yk-muted);
}

.status-card {
  margin-bottom: 14px;
  padding: 20px;
  border: 1px solid var(--yk-border);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 12px 34px rgba(34, 39, 51, 0.07);
}

.status-loading {
  display: grid;
  place-items: center;
  min-height: 240px;
  color: var(--yk-muted);
}

.status-loading p {
  margin: 10px 0 0;
}

.status-hero {
  background: linear-gradient(145deg, #fff, #fdf2f4);
  border-color: #f5d6db;
}

.status-hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.status-ticket-label {
  font-size: 11px;
  color: var(--yk-muted);
  letter-spacing: 1px;
}

.status-ticket {
  margin-top: 5px;
  font-size: 26px;
  line-height: 1.1;
  font-weight: 900;
  color: #111;
  word-break: break-all;
}

.status-current {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px dashed #f0c2c9;
}

.status-current-label {
  font-size: 12px;
  color: var(--yk-muted);
}

.status-current-name {
  margin-top: 6px;
  font-size: 24px;
  font-weight: 800;
  color: var(--yk-red);
}

.status-current-meta {
  margin-top: 6px;
  font-size: 12px;
  color: var(--yk-muted);
}

.status-section-title {
  margin-bottom: 14px;
  padding-left: 9px;
  border-left: 3px solid var(--yk-red);
  font-size: 14px;
  font-weight: 700;
}

.status-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 20px;
}

.status-info-item span {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  color: var(--yk-muted);
}

.status-info-item strong {
  font-size: 14px;
  font-weight: 600;
  color: #3b3f46;
}

.status-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.status-event {
  position: relative;
  display: flex;
  gap: 12px;
  padding-bottom: 16px;
}

.status-event:last-child {
  padding-bottom: 0;
}

.status-event::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 14px;
  bottom: 0;
  width: 1px;
  background: #e7e9ee;
}

.status-event:last-child::before {
  display: none;
}

.status-event-dot {
  width: 11px;
  height: 11px;
  flex: 0 0 11px;
  margin-top: 4px;
  border-radius: 50%;
  box-shadow: 0 0 0 4px #fff;
  z-index: 1;
}

.status-event-body {
  flex: 1;
  min-width: 0;
}

.status-event-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
}

.status-event-round {
  font-size: 11px;
  font-weight: 400;
  color: var(--yk-muted);
}

.status-event-date {
  margin-top: 3px;
  font-size: 12px;
  color: var(--yk-muted);
}

.status-footer {
  padding: 4px 6px 0;
  text-align: center;
  color: var(--yk-muted);
  font-size: 12px;
  line-height: 1.7;
}

.status-footer p {
  margin: 0 0 4px;
}

.status-privacy {
  margin-top: 10px !important;
  font-size: 11px;
  color: #a0a5ae;
}

@media (max-width: 600px) {
  .status-page {
    padding: 18px 12px 30px;
  }

  .status-info-grid {
    grid-template-columns: 1fr;
  }

  .status-ticket {
    font-size: 23px;
  }

  .status-current-name {
    font-size: 21px;
  }
}
</style>
