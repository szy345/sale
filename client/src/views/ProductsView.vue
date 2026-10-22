<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>商品管理</h2>
        <p>一个货号可配置多个颜色和尺码，维修登记时按货号、颜色、尺码选择</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>新增商品
        </el-button>
      </div>
    </div>

    <div class="panel filter-panel">
      <el-form :inline="true" label-position="top" @submit.prevent="search">
        <div class="filter-row">
          <el-form-item label="关键词">
            <el-input
              v-model="keyword"
              placeholder="货号 / 商品名称 / 颜色 / 尺码"
              clearable
              @keyup.enter="search"
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
        <span class="total">共 <strong>{{ total }}</strong> 个商品货号</span>
        <el-button text :loading="loading" @click="load">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>

      <el-table v-loading="loading" :data="items" style="width: 100%" row-key="id">
        <el-table-column prop="item_no" label="货号" min-width="140">
          <template #default="{ row }">
            <strong class="item-no">{{ row.item_no }}</strong>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="商品名称" min-width="140" show-overflow-tooltip />
        <el-table-column label="颜色" min-width="180">
          <template #default="{ row }">
            <div class="tag-list">
              <el-tag
                v-for="(color, index) in productValues(row, 'color').slice(0, 4)"
                :key="`${color}-${index}`"
                size="small"
                effect="plain"
                :type="color ? 'primary' : 'info'"
              >
                {{ color || '默认' }}
              </el-tag>
              <span v-if="productValues(row, 'color').length > 4" class="more-text">
                +{{ productValues(row, 'color').length - 4 }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="尺码" min-width="180">
          <template #default="{ row }">
            <div class="tag-list">
              <el-tag
                v-for="(size, index) in productValues(row, 'size').slice(0, 6)"
                :key="`${size}-${index}`"
                size="small"
                effect="plain"
                :type="size ? 'success' : 'info'"
              >
                {{ size || '默认' }}
              </el-tag>
              <span v-if="productValues(row, 'size').length > 6" class="more-text">
                +{{ productValues(row, 'size').length - 6 }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="规格数" width="90" align="center">
          <template #default="{ row }">{{ row.variants?.length || 0 }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '—' }}</template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="150">
          <template #default="{ row }">{{ formatDateTime(row.updated_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="145" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="isAdmin" link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无商品，请先新增商品" :image-size="90" />
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

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑商品' : '新增商品'"
      width="720px"
      destroy-on-close
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-row :gutter="16">
          <el-col :xs="24" :sm="10">
            <el-form-item label="货号" prop="item_no">
              <el-input v-model="form.item_no" maxlength="100" placeholder="例如 YK-1001" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="14">
            <el-form-item label="商品名称" prop="name">
              <el-input v-model="form.name" maxlength="100" placeholder="例如：女士皮鞋" />
            </el-form-item>
          </el-col>
        </el-row>

        <div class="form-section-title">规格组合</div>
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="颜色（可多选）">
              <el-select
                v-model="form.colors"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="选择颜色，或输入其他颜色后回车"
                style="width: 100%"
              >
                <el-option
                  v-for="color in PRODUCT_COLOR_OPTIONS"
                  :key="color"
                  :label="color"
                  :value="color"
                />
              </el-select>
              <div class="muted small field-hint">没有的颜色可直接输入后按回车添加</div>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="尺码（可多选）">
              <el-select
                v-model="form.sizes"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="选择尺码，或输入其他尺码后回车"
                style="width: 100%"
              >
                <el-option
                  v-for="size in PRODUCT_SIZE_OPTIONS"
                  :key="size"
                  :label="size"
                  :value="size"
                />
              </el-select>
              <div class="muted small field-hint">没有的尺码可直接输入后按回车添加</div>
            </el-form-item>
          </el-col>
        </el-row>

        <div class="variant-toolbar">
          <div>
            规格组合
            <span class="muted small">共 {{ form.variants.length }} 个</span>
          </div>
          <el-button size="small" @click="generateVariants">按颜色 × 尺码重新生成</el-button>
        </div>

        <el-table
          :data="form.variants"
          size="small"
          border
          max-height="230"
          style="width: 100%"
        >
          <el-table-column label="颜色" min-width="150">
            <template #default="{ row }">{{ row.color || '默认' }}</template>
          </el-table-column>
          <el-table-column label="尺码" min-width="120">
            <template #default="{ row }">{{ row.size || '默认' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ $index }">
              <el-button link type="danger" @click="removeVariant($index)">移除</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <span class="muted">选择颜色和尺码后会自动生成组合</span>
          </template>
        </el-table>
        <div class="muted small field-hint">
          例如选择 3 种颜色、5 个尺码，会自动生成 15 个规格；不需要的组合可以单独移除。
        </div>

        <el-form-item label="备注" prop="remark" style="margin-top: 8px">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="2"
            maxlength="500"
            show-word-limit
            placeholder="选填"
          />
        </el-form-item>
        <el-alert
          title="货号必须唯一；同一商品名称可以有多个货号。"
          type="info"
          :closable="false"
          show-icon
        />
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { errorMessage } from '../api';
import { PRODUCT_COLOR_OPTIONS, PRODUCT_SIZE_OPTIONS } from '../constants';
import { auth } from '../stores/auth';
import { formatDateTime } from '../utils/format';

const loading = ref(false);
const saving = ref(false);
const items = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref('');
const dialogVisible = ref(false);
const editingId = ref(null);
const formRef = ref();
let syncingVariants = false;

const isAdmin = computed(() => auth.user?.role === 'admin');

const form = reactive({
  item_no: '',
  name: '',
  colors: [],
  sizes: [],
  variants: [{ color: '', size: '' }],
  remark: '',
});

const rules = {
  item_no: [{ required: true, message: '请输入货号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
};

function uniqueValues(values) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const text = String(value || '').trim();
    if (seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function generateVariants() {
  if (syncingVariants) return;
  const colors = uniqueValues(form.colors);
  const sizes = uniqueValues(form.sizes);
  const colorList = colors.length ? colors : [''];
  const sizeList = sizes.length ? sizes : [''];
  const seen = new Set();
  form.variants = colorList
    .flatMap((color) => sizeList.map((size) => ({ color, size })))
    .filter((variant) => {
      const key = `${variant.color}\u0000${variant.size}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

watch(
  () => [form.colors.join('\u0000'), form.sizes.join('\u0000')],
  () => generateVariants(),
  { flush: 'sync' },
);

function productValues(row, field) {
  const values = uniqueValues((row.variants || []).map((variant) => variant[field] || ''));
  return values.length ? values : [''];
}

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get('/products', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        keyword: keyword.value || undefined,
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
  keyword.value = '';
  page.value = 1;
  load();
}

function handleSizeChange() {
  page.value = 1;
  load();
}

function openCreate() {
  editingId.value = null;
  syncingVariants = true;
  Object.assign(form, {
    item_no: '',
    name: '',
    colors: [],
    sizes: [],
    variants: [{ color: '', size: '' }],
    remark: '',
  });
  syncingVariants = false;
  dialogVisible.value = true;
}

function openEdit(row) {
  editingId.value = row.id;
  const variants = (row.variants || []).map((variant) => ({
    color: variant.color || '',
    size: variant.size || '',
  }));
  syncingVariants = true;
  Object.assign(form, {
    item_no: row.item_no,
    name: row.name,
    colors: uniqueValues(variants.map((variant) => variant.color).filter(Boolean)),
    sizes: uniqueValues(variants.map((variant) => variant.size).filter(Boolean)),
    variants: variants.length ? variants : [{ color: '', size: '' }],
    remark: row.remark || '',
  });
  syncingVariants = false;
  dialogVisible.value = true;
}

function removeVariant(index) {
  form.variants.splice(index, 1);
  if (!form.variants.length) form.variants.push({ color: '', size: '' });
}

async function submit() {
  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  if (!form.variants.length) generateVariants();
  const variants = uniqueValues(
    form.variants.map((variant) => `${variant.color}\u0000${variant.size}`),
  ).map((key) => {
    const [color, size] = key.split('\u0000');
    return { color, size };
  });

  saving.value = true;
  try {
    const payload = {
      item_no: form.item_no,
      name: form.name,
      remark: form.remark,
      variants,
    };
    if (editingId.value) {
      await api.patch(`/products/${editingId.value}`, payload);
      ElMessage.success('商品已保存');
    } else {
      await api.post('/products', payload);
      ElMessage.success('商品已新增');
    }
    dialogVisible.value = false;
    await load();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除商品 ${row.item_no}（${row.name}）吗？该商品的颜色和尺码规格也会删除，已登记的维修单不会受影响。`,
      '删除商品',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }

  try {
    await api.delete(`/products/${row.id}`);
    ElMessage.success('商品已删除');
    await load();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}

onMounted(load);
</script>

<style scoped>
.item-no {
  color: var(--yk-red);
  font-family: Consolas, Monaco, 'Courier New', monospace;
  letter-spacing: 0.2px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.more-text {
  font-size: 12px;
  color: var(--yk-muted);
  align-self: center;
}

.variant-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 6px 0 10px;
  font-size: 14px;
  font-weight: 700;
}

.field-hint {
  margin-top: 5px;
}
</style>
