<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>维修管理</h2>
        <p>查询维修单、跟进返厂进度和客户取鞋状态</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="router.push('/repairs/new')">
          <el-icon><Plus /></el-icon>新增维修单
        </el-button>
      </div>
    </div>

    <div class="panel filter-panel">
      <el-form :inline="true" label-position="top" @submit.prevent="search">
        <div class="filter-row">
          <el-form-item label="关键词">
            <el-input
              v-model="filters.keyword"
              placeholder="编号 / 顾客 / 电话 / 商品"
              clearable
              @keyup.enter="search"
            />
          </el-form-item>
          <el-form-item label="状态">
            <el-select
              v-model="filters.status"
              placeholder="全部状态"
              clearable
              @change="handleStatusChange"
            >
              <el-option
                v-for="option in REPAIR_STATUS_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="显示范围">
            <el-checkbox v-model="filters.hidePicked" @change="handleHidePickedChange">
              屏蔽客户已取走记录
            </el-checkbox>
          </el-form-item>
          <el-form-item label="维修日期">
            <el-date-picker
              v-model="filters.dateRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
            />
          </el-form-item>
          <el-form-item label=" ">
            <el-button type="primary" @click="search">
              <el-icon><Search /></el-icon>查询
            </el-button>
            <el-button @click="reset">重置</el-button>
          </el-form-item>
        </div>
      </el-form>
    </div>

    <div class="panel table-panel">
      <div class="table-toolbar">
        <span class="total">共 <strong>{{ total }}</strong> 条维修记录</span>
        <el-button text :loading="loading" @click="load">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="items"
        style="width: 100%"
        row-key="id"
        :row-class-name="rowClassName"
      >
        <el-table-column label="维修编号" min-width="158">
          <template #default="{ row }">
            <span class="ticket-link" @click="router.push(`/repairs/${row.id}`)">
              {{ row.ticket_no }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="repair_date" label="日期" width="108" />
        <el-table-column label="顾客" min-width="128">
          <template #default="{ row }">
            <div>{{ row.customer_name }}</div>
            <div class="muted small phone">{{ row.phone }}</div>
          </template>
        </el-table-column>
        <el-table-column label="商品" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">{{ productSummary(row) }}</template>
        </el-table-column>
        <el-table-column prop="problem" label="问题" min-width="170" show-overflow-tooltip />
        <el-table-column label="状态" min-width="120">
          <template #default="{ row }">
            <StatusTag :status="row.status" />
            <div v-if="row.current_round > 1" class="muted small">第 {{ row.current_round }} 轮</div>
          </template>
        </el-table-column>
        <el-table-column prop="operator_name" label="登记人" width="95" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push(`/repairs/${row.id}`)">
              详情
            </el-button>
            <el-button link @click="router.push(`/print/repair/${row.id}`)">打印</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无维修记录" :image-size="90" />
        </template>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="load"
          @size-change="handleSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api, { errorMessage } from '../../api';
import StatusTag from '../../components/StatusTag.vue';
import { REPAIR_STATUS_OPTIONS } from '../../constants';
import { productSummary } from '../../utils/format';

const router = useRouter();
const route = useRoute();

const loading = ref(false);
const items = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const initialStatus = typeof route.query.status === 'string' ? route.query.status : '';
const initialDateRange =
  typeof route.query.dateFrom === 'string' && typeof route.query.dateTo === 'string'
    ? [route.query.dateFrom, route.query.dateTo]
    : [];
const filters = reactive({
  keyword: '',
  status: initialStatus,
  hidePicked: initialStatus !== 'customer_picked',
  dateRange: initialDateRange,
});

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get('/repairs', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        keyword: filters.keyword || undefined,
        status: filters.status || undefined,
        excludeStatus: filters.hidePicked ? 'customer_picked' : undefined,
        dateFrom: filters.dateRange?.[0],
        dateTo: filters.dateRange?.[1],
      },
    });
    items.value = data.items;
    total.value = data.total;
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

function search() {
  page.value = 1;
  load();
}

function reset() {
  filters.keyword = '';
  filters.status = '';
  filters.hidePicked = true;
  filters.dateRange = [];
  page.value = 1;
  load();
}

function handleStatusChange(value) {
  if (value === 'customer_picked') {
    filters.hidePicked = false;
  }
}

function handleHidePickedChange(value) {
  if (value && filters.status === 'customer_picked') {
    filters.status = '';
  }
  page.value = 1;
  load();
}

function handleSizeChange() {
  page.value = 1;
  load();
}

function rowClassName({ row }) {
  return row.status === 'customer_picked' ? 'completed-row' : '';
}

watch(
  () => route.query.status,
  (value) => {
    if (typeof value === 'string') {
      filters.status = value;
      if (value === 'customer_picked') filters.hidePicked = false;
      page.value = 1;
      load();
    }
  },
);

watch(
  () => [route.query.dateFrom, route.query.dateTo],
  ([from, to]) => {
    if (typeof from === 'string' && typeof to === 'string') {
      filters.dateRange = [from, to];
      page.value = 1;
      load();
    }
  },
);

onMounted(load);
</script>

<style scoped>
:deep(.el-table__body tr.completed-row > td.el-table__cell) {
  background: #f3fbf6 !important;
}

:deep(.el-table__body tr.completed-row:hover > td.el-table__cell) {
  background: #eaf8ef !important;
}

:deep(.el-table__body tr.completed-row > td.el-table__cell:first-child) {
  box-shadow: inset 3px 0 0 #15803d;
}
</style>
