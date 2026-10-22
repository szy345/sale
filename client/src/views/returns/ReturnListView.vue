<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>退货管理</h2>
        <p>登记和查询顾客退货信息</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="router.push('/returns/new')">
          <el-icon><Plus /></el-icon>新增退货单
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
          <el-form-item label="处理方式">
            <el-select v-model="filters.handling" placeholder="全部方式" clearable>
              <el-option
                v-for="option in HANDLING_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="退货日期">
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
        <span class="total">共 <strong>{{ total }}</strong> 条退货记录</span>
        <el-button text :loading="loading" @click="load">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>

      <el-table v-loading="loading" :data="items" style="width: 100%" row-key="id">
        <el-table-column label="退货编号" min-width="158">
          <template #default="{ row }">
            <span class="ticket-link" @click="router.push(`/returns/${row.id}`)">
              {{ row.return_no }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="return_date" label="日期" width="108" />
        <el-table-column label="顾客" min-width="125">
          <template #default="{ row }">
            <div>{{ row.customer_name }}</div>
            <div class="muted small phone">{{ row.phone }}</div>
          </template>
        </el-table-column>
        <el-table-column label="商品" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">{{ productSummary(row) }}</template>
        </el-table-column>
        <el-table-column prop="reason" label="退货原因" min-width="125" show-overflow-tooltip />
        <el-table-column label="处理方式" width="105">
          <template #default="{ row }"><HandlingTag :handling="row.handling" /></template>
        </el-table-column>
        <el-table-column label="金额" width="105" align="right">
          <template #default="{ row }">
            <span class="money">¥{{ centsToYuan(row.refund_amount_cents) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="operator_name" label="登记人" width="95" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push(`/returns/${row.id}`)">
              详情
            </el-button>
            <el-button link @click="router.push(`/print/return/${row.id}`)">打印</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无退货记录" :image-size="90" />
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
import HandlingTag from '../../components/HandlingTag.vue';
import { HANDLING_OPTIONS } from '../../constants';
import { centsToYuan, productSummary } from '../../utils/format';

const router = useRouter();
const route = useRoute();

const loading = ref(false);
const items = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const initialDateRange =
  typeof route.query.dateFrom === 'string' && typeof route.query.dateTo === 'string'
    ? [route.query.dateFrom, route.query.dateTo]
    : [];
const filters = reactive({
  keyword: '',
  handling: '',
  dateRange: initialDateRange,
});

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get('/returns', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        keyword: filters.keyword || undefined,
        handling: filters.handling || undefined,
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
  filters.handling = '';
  filters.dateRange = [];
  page.value = 1;
  load();
}

function handleSizeChange() {
  page.value = 1;
  load();
}

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
