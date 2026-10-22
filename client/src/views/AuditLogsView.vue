<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>操作日志</h2>
        <p>记录登录、维修、退货和账号管理等关键操作</p>
      </div>
    </div>

    <div class="panel filter-panel">
      <el-form :inline="true" label-position="top" @submit.prevent="search">
        <div class="filter-row">
          <el-form-item label="关键词">
            <el-input
              v-model="filters.keyword"
              placeholder="账号 / 操作 / 内容"
              clearable
              @keyup.enter="search"
            />
          </el-form-item>
          <el-form-item label="操作类型">
            <el-select v-model="filters.action" placeholder="全部操作" clearable filterable>
              <el-option
                v-for="action in actions"
                :key="action"
                :label="actionLabel(action)"
                :value="action"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="对象类型">
            <el-select v-model="filters.entityType" placeholder="全部对象" clearable>
              <el-option
                v-for="(label, value) in ENTITY_TYPE_LABELS"
                :key="value"
                :label="label"
                :value="value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="操作日期">
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
        <span class="total">共 <strong>{{ total }}</strong> 条操作日志</span>
        <el-button text :loading="loading" @click="load">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>

      <el-table v-loading="loading" :data="items" style="width: 100%" row-key="id">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="audit-detail">
              <div class="muted small" style="margin-bottom: 6px">操作详情</div>
              <pre v-if="row.detail">{{ prettyDetail(row.detail) }}</pre>
              <span v-else class="muted">无额外详情</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="时间" min-width="155">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column prop="username" label="操作人" width="110" show-overflow-tooltip />
        <el-table-column label="操作" min-width="135">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ actionLabel(row.action) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="对象" width="100">
          <template #default="{ row }">{{ ENTITY_TYPE_LABELS[row.entity_type] || row.entity_type || '—' }}</template>
        </el-table-column>
        <el-table-column prop="entity_id" label="对象编号" width="100">
          <template #default="{ row }">{{ row.entity_id || '—' }}</template>
        </el-table-column>
        <el-table-column prop="ip" label="IP 地址" min-width="140" show-overflow-tooltip />
        <template #empty>
          <el-empty description="暂无操作日志" :image-size="90" />
        </template>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[20, 50, 100]"
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
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import api, { errorMessage } from '../api';
import { AUDIT_ACTION_LABELS, ENTITY_TYPE_LABELS } from '../constants';
import { formatDateTime } from '../utils/format';

const loading = ref(false);
const items = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const actions = ref([]);

const filters = reactive({
  keyword: '',
  action: '',
  entityType: '',
  dateRange: [],
});

function actionLabel(action) {
  return AUDIT_ACTION_LABELS[action] || action;
}

function prettyDetail(detail) {
  if (typeof detail === 'string') return detail;
  return JSON.stringify(detail, null, 2);
}

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get('/audit-logs', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        keyword: filters.keyword || undefined,
        action: filters.action || undefined,
        entityType: filters.entityType || undefined,
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

async function loadActions() {
  try {
    const { data } = await api.get('/audit-logs/actions');
    actions.value = data.items;
  } catch {
    actions.value = [];
  }
}

function search() {
  page.value = 1;
  load();
}

function reset() {
  filters.keyword = '';
  filters.action = '';
  filters.entityType = '';
  filters.dateRange = [];
  page.value = 1;
  load();
}

function handleSizeChange() {
  page.value = 1;
  load();
}

onMounted(() => {
  loadActions();
  load();
});
</script>

<style scoped>
.audit-detail {
  padding: 10px 18px 18px 48px;
}

.audit-detail pre {
  margin: 0;
  padding: 12px 14px;
  background: #f7f8fa;
  border: 1px solid #eceef2;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: #4b5058;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: Consolas, Monaco, 'Courier New', monospace;
}
</style>
