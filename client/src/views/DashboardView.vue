<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>工作台</h2>
        <p>维修与退货业务概览 · {{ data.today || today() }}</p>
      </div>
      <div class="page-actions">
        <el-button @click="router.push('/returns/new')">
          <el-icon><RefreshLeft /></el-icon>新增退货
        </el-button>
        <el-button type="primary" @click="router.push('/repairs/new')">
          <el-icon><Plus /></el-icon>新增维修
        </el-button>
      </div>
    </div>

    <el-skeleton :loading="loading" animated :rows="6">
      <template #default>
        <div class="panel status-flow-panel">
          <div class="panel-header flow-panel-header">
            <div>
              <h3>维修状态流转</h3>
              <p class="status-flow-subtitle">点击状态查看对应维修记录</p>
            </div>
            <div class="flow-header-actions">
              <div class="flow-summary">
                <button type="button" class="flow-summary-item" @click="goTodayRepairs">
                  今日维修 <strong>{{ counts.todayRepairs || 0 }}</strong>
                </button>
                <button type="button" class="flow-summary-item" @click="goTodayReturns">
                  今日退货 <strong>{{ counts.todayReturns || 0 }}</strong>
                </button>
                <button type="button" class="flow-summary-item" @click="goMonthReturns">
                  本月退货 <strong>{{ counts.monthReturns || 0 }}</strong>
                </button>
              </div>
              <el-button link type="primary" @click="router.push('/repairs')">全部维修单</el-button>
            </div>
          </div>
          <div class="status-flow">
            <template v-for="(step, index) in flowSteps" :key="step.status">
              <button
                type="button"
                class="flow-step"
                :style="{ '--step-color': step.color, '--step-tint': step.tint }"
                @click="goStatus(step.status)"
              >
                <span class="flow-index">{{ index + 1 }}</span>
                <span class="flow-main">
                  <span class="flow-name">{{ step.label }}</span>
                  <span class="flow-hint">{{ step.hint }}</span>
                </span>
                <strong class="flow-count">{{ step.count }}</strong>
              </button>
              <span v-if="index < flowSteps.length - 1" class="flow-arrow">→</span>
            </template>
          </div>
        </div>

        <div class="dashboard-grid">
          <div class="panel">
            <div class="panel-header">
              <h3>最近维修单</h3>
              <el-button link type="primary" @click="router.push('/repairs')">查看全部</el-button>
            </div>
            <el-table :data="data.recentRepairs || []" size="small" style="width: 100%">
              <el-table-column label="编号" min-width="145">
                <template #default="{ row }">
                  <span class="ticket-link" @click="router.push(`/repairs/${row.id}`)">
                    {{ row.ticket_no }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="顾客" min-width="125">
                <template #default="{ row }">
                  <div>{{ row.customer_name }}</div>
                  <div class="muted small">{{ row.phone }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="product_name" label="商品" min-width="110" show-overflow-tooltip />
              <el-table-column label="状态" min-width="115">
                <template #default="{ row }"><StatusTag :status="row.status" /></template>
              </el-table-column>
              <el-table-column prop="repair_date" label="日期" width="105" />
            </el-table>
          </div>

          <div class="panel">
            <div class="panel-header">
              <h3>最近退货单</h3>
              <el-button link type="primary" @click="router.push('/returns')">查看全部</el-button>
            </div>
            <el-table :data="data.recentReturns || []" size="small" style="width: 100%">
              <el-table-column label="编号" min-width="130">
                <template #default="{ row }">
                  <span class="ticket-link" @click="router.push(`/returns/${row.id}`)">
                    {{ row.return_no }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="customer_name" label="顾客" width="90" show-overflow-tooltip />
              <el-table-column label="处理" width="80">
                <template #default="{ row }"><HandlingTag :handling="row.handling" /></template>
              </el-table-column>
              <el-table-column label="金额" width="90" align="right">
                <template #default="{ row }">¥{{ centsToYuan(row.refund_amount_cents) }}</template>
              </el-table-column>
            </el-table>
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
import api, { errorMessage } from '../api';
import HandlingTag from '../components/HandlingTag.vue';
import StatusTag from '../components/StatusTag.vue';
import { centsToYuan, today } from '../utils/format';

const router = useRouter();
const loading = ref(true);
const data = ref({});
const counts = computed(() => data.value.counts || {});

const flowSteps = computed(() => [
  {
    status: 'pending_factory',
    label: '待返厂维修',
    hint: '等待寄往厂家',
    count: counts.value.pendingFactory || 0,
    color: '#e60012',
    tint: 'rgba(230, 0, 18, 0.10)',
  },
  {
    status: 'sent_factory',
    label: '已返厂维修',
    hint: '厂家维修中',
    count: counts.value.sentFactory || 0,
    color: '#e67e22',
    tint: 'rgba(230, 126, 34, 0.13)',
  },
  {
    status: 'factory_returned',
    label: '厂家已寄回',
    hint: '等待通知客户',
    count: counts.value.factoryReturned || 0,
    color: '#909399',
    tint: 'rgba(144, 147, 153, 0.12)',
  },
  {
    status: 'customer_notified',
    label: '已通知客户',
    hint: '等待客户取走',
    count: counts.value.customerNotified || 0,
    color: '#7c3aed',
    tint: 'rgba(124, 58, 237, 0.10)',
  },
  {
    status: 'customer_picked',
    label: '客户已取走',
    hint: '本轮维修已完成',
    count: counts.value.customerPicked || 0,
    color: '#15803d',
    tint: 'rgba(21, 128, 61, 0.10)',
  },
]);

function goRepairs(query = {}) {
  router.push({ path: '/repairs', query });
}

function goReturns(query = {}) {
  router.push({ path: '/returns', query });
}

function goStatus(status) {
  goRepairs({ status });
}

function goTodayRepairs() {
  const day = data.value.today || today();
  goRepairs({ dateFrom: day, dateTo: day });
}

function goTodayReturns() {
  const day = data.value.today || today();
  goReturns({ dateFrom: day, dateTo: day });
}

function goMonthReturns() {
  const day = data.value.today || today();
  goReturns({ dateFrom: `${day.slice(0, 7)}-01`, dateTo: day });
}

async function load() {
  loading.value = true;
  try {
    const response = await api.get('/dashboard');
    data.value = response.data;
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
