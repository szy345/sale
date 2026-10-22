<template>
  <el-row :gutter="18">
    <el-col :xs="24" :sm="12" :md="8">
      <el-form-item label="维修日期" prop="repair_date">
        <el-date-picker
          v-model="form.repair_date"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          style="width: 100%"
        />
      </el-form-item>
    </el-col>
    <el-col :xs="24" :sm="12" :md="8">
      <el-form-item label="顾客姓名" prop="customer_name">
        <el-input v-model="form.customer_name" maxlength="50" placeholder="请输入顾客姓名" />
      </el-form-item>
    </el-col>
    <el-col :xs="24" :sm="12" :md="8">
      <el-form-item label="联系电话" prop="phone">
        <el-input v-model="form.phone" maxlength="30" placeholder="手机号或固定电话" />
      </el-form-item>
    </el-col>
  </el-row>

  <div class="form-section-title">商品信息</div>
  <el-form-item label="商品名称（按货号选择）" prop="product_id">
    <el-select
      v-model="form.product_id"
      filterable
      clearable
      :loading="productLoading"
      placeholder="输入货号或商品名称搜索"
      style="width: 100%"
      @change="handleProductChange"
      @clear="clearProduct"
    >
      <el-option
        v-for="product in productOptions"
        :key="product.id"
        :label="productLabel(product)"
        :value="product.id"
      >
        <div class="product-option">
          <span class="product-item-no">{{ product.item_no }}</span>
          <span class="product-name">{{ product.name }}</span>
          <span class="product-spec">{{ product.variants?.length || 0 }} 个规格</span>
        </div>
      </el-option>
    </el-select>
    <div v-if="selectedProduct" class="muted small product-hint">
      该货号包含 {{ productColorCount }} 种颜色 / {{ productSizeCount }} 个尺码
    </div>
    <div v-else-if="!productLoading && !productOptions.length" class="muted small product-hint">
      暂无商品数据，可先到“商品管理”新增，或在下方手工填写。
    </div>
  </el-form-item>

  <el-row :gutter="18">
    <el-col :xs="24" :sm="12" :md="8">
      <el-form-item label="商品名称" prop="product_name">
        <el-input
          v-model="form.product_name"
          maxlength="100"
          placeholder="选择商品后自动填充"
          :readonly="Boolean(form.product_id)"
        />
      </el-form-item>
    </el-col>
    <el-col :xs="24" :sm="12" :md="8">
      <el-form-item label="货号" prop="item_no">
        <el-input
          v-model="form.item_no"
          maxlength="100"
          placeholder="选择商品后自动填充"
          :readonly="Boolean(form.product_id)"
        />
      </el-form-item>
    </el-col>
    <el-col :xs="12" :sm="6" :md="4">
      <el-form-item label="颜色" prop="color">
        <el-select
          v-if="selectedProduct && availableColors.length"
          v-model="form.color"
          placeholder="请选择颜色"
          style="width: 100%"
          @change="handleColorChange"
        >
          <el-option
            v-for="color in availableColors"
            :key="color || '__default_color'"
            :label="color || '默认颜色'"
            :value="color"
          />
        </el-select>
        <el-input
          v-else
          v-model="form.color"
          maxlength="50"
          placeholder="颜色"
          :readonly="Boolean(form.product_id)"
        />
      </el-form-item>
    </el-col>
    <el-col :xs="12" :sm="6" :md="4">
      <el-form-item label="尺码" prop="size">
        <el-select
          v-if="selectedProduct"
          v-model="form.size"
          :disabled="availableColors.length > 1 && !form.color"
          :placeholder="sizePlaceholder"
          style="width: 100%"
        >
          <el-option
            v-for="size in availableSizes"
            :key="size || '__default_size'"
            :label="size || '默认尺码'"
            :value="size"
          />
        </el-select>
        <el-input
          v-else
          v-model="form.size"
          maxlength="50"
          placeholder="尺码"
          :readonly="Boolean(form.product_id)"
        />
      </el-form-item>
    </el-col>
  </el-row>

  <div class="form-section-title">问题描述</div>
  <el-form-item label="顾客反馈的问题" prop="problem">
    <el-input
      v-model="form.problem"
      type="textarea"
      :rows="4"
      maxlength="2000"
      show-word-limit
      placeholder="请描述鞋子存在的问题、顾客诉求等"
    />
  </el-form-item>
  <el-form-item label="备注" prop="remark">
    <el-input
      v-model="form.remark"
      type="textarea"
      :rows="2"
      maxlength="2000"
      show-word-limit
      placeholder="选填"
    />
  </el-form-item>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import api, { errorMessage } from '../api';

const props = defineProps({
  form: { type: Object, required: true },
});

const productOptions = ref([]);
const productLoading = ref(false);

const selectedProduct = computed(
  () => productOptions.value.find((product) => product.id === props.form.product_id) || null,
);
const productColorCount = computed(() => uniqueValues(
  (selectedProduct.value?.variants || []).map((variant) => variant.color || ''),
).length);
const productSizeCount = computed(() => uniqueValues(
  (selectedProduct.value?.variants || []).map((variant) => variant.size || ''),
).length);
const availableColors = computed(() => {
  if (!selectedProduct.value) return [];
  const colors = uniqueValues(
    (selectedProduct.value.variants || []).map((variant) => variant.color || ''),
  );
  if (props.form.color && !colors.includes(props.form.color)) colors.push(props.form.color);
  return colors;
});
const availableSizes = computed(() => {
  if (!selectedProduct.value) return [];
  if (availableColors.value.length > 1 && !props.form.color) return [];
  const sizes = sizesForColor(selectedProduct.value, props.form.color);
  if (props.form.size && !sizes.includes(props.form.size)) sizes.push(props.form.size);
  return sizes;
});
const sizePlaceholder = computed(() => {
  if (availableColors.value.length > 1 && !props.form.color) return '请先选择颜色';
  return '请选择尺码';
});

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

function sizesForColor(product, color) {
  return uniqueValues(
    (product?.variants || [])
      .filter((variant) => (variant.color || '') === (color || ''))
      .map((variant) => variant.size || ''),
  );
}

function productLabel(product) {
  return [product.item_no, product.name].filter(Boolean).join(' · ');
}

function handleProductChange(id) {
  if (!id) {
    clearProduct();
    return;
  }

  const product = productOptions.value.find((item) => item.id === id);
  if (!product) return;

  props.form.product_id = product.id;
  props.form.product_name = product.name || '';
  props.form.item_no = product.item_no || '';

  const colors = uniqueValues(
    (product.variants || []).map((variant) => variant.color || ''),
  );
  props.form.color = colors.length === 1 ? colors[0] : '';
  const sizes = sizesForColor(product, props.form.color);
  props.form.size = sizes.length === 1 ? sizes[0] : '';
}

function handleColorChange() {
  const sizes = sizesForColor(selectedProduct.value, props.form.color);
  if (!sizes.includes(props.form.size)) {
    props.form.size = sizes.length === 1 ? sizes[0] : '';
  }
}

function clearProduct() {
  props.form.product_id = null;
  props.form.product_name = '';
  props.form.item_no = '';
  props.form.color = '';
  props.form.size = '';
}

async function loadProducts() {
  productLoading.value = true;
  try {
    const { data } = await api.get('/products/options');
    productOptions.value = data.items || [];
  } catch (error) {
    ElMessage.warning(`商品列表加载失败：${errorMessage(error)}`);
  } finally {
    productLoading.value = false;
  }
}

onMounted(loadProducts);
</script>

<style scoped>
.product-option {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.product-item-no {
  flex: 0 0 auto;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-weight: 700;
  color: var(--yk-red);
}

.product-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-spec {
  flex: 0 0 auto;
  color: var(--text-color-secondary, #909399);
  font-size: 12px;
}

.product-hint {
  margin-top: 5px;
}
</style>
