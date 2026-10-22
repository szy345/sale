<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>{{ isEdit ? '编辑退货单' : '新增退货单' }}</h2>
        <p>{{ isEdit ? '修改退货登记信息' : '登记顾客退货信息，退货模块仅做记录，不涉及状态流转' }}</p>
      </div>
      <div class="page-actions">
        <el-button @click="router.back()">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">
          <el-icon><Check /></el-icon>保存退货单
        </el-button>
      </div>
    </div>

    <div class="panel panel-pad">
      <el-skeleton :loading="loading" animated :rows="6">
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          @submit.prevent="submit"
        >
          <ReturnFields :form="form" />
          <div class="form-actions">
            <el-button type="primary" :loading="saving" @click="submit">保存退货单</el-button>
            <el-button @click="router.push('/returns')">返回列表</el-button>
          </div>
        </el-form>
      </el-skeleton>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api, { errorMessage } from '../../api';
import ReturnFields from '../../components/ReturnFields.vue';
import { centsToYuan, today, yuanToCents } from '../../utils/format';

const route = useRoute();
const router = useRouter();

const isEdit = computed(() => route.name === 'return-edit');
const formRef = ref();
const loading = ref(false);
const saving = ref(false);

const form = reactive({
  return_date: today(),
  customer_name: '',
  phone: '',
  product_name: '',
  item_no: '',
  color: '',
  size: '',
  purchase_date: '',
  receipt_no: '',
  reason: '',
  handling: 'refund',
  refund_amount: 0,
  remark: '',
});

const rules = {
  return_date: [{ required: true, message: '请选择退货日期', trigger: 'change' }],
  customer_name: [{ required: true, message: '请输入顾客姓名', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入联系电话', trigger: 'blur' },
    { pattern: /^[0-9+\-\s()]+$/, message: '电话格式不正确', trigger: 'blur' },
  ],
  product_name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  reason: [{ required: true, message: '请选择或输入退货原因', trigger: 'change' }],
  handling: [{ required: true, message: '请选择处理方式', trigger: 'change' }],
};

async function load() {
  if (!isEdit.value) return;
  loading.value = true;
  try {
    const { data } = await api.get(`/returns/${route.params.id}`);
    const keys = [
      'return_date',
      'customer_name',
      'phone',
      'product_name',
      'item_no',
      'color',
      'size',
      'purchase_date',
      'receipt_no',
      'reason',
      'handling',
      'remark',
    ];
    for (const key of keys) form[key] = data[key] ?? '';
    form.refund_amount = Number(centsToYuan(data.refund_amount_cents));
  } catch (error) {
    ElMessage.error(errorMessage(error));
    router.replace('/returns');
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (saving.value) return;
  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  saving.value = true;
  try {
    const payload = {
      ...form,
      purchase_date: form.purchase_date || null,
      refund_amount_cents: yuanToCents(form.refund_amount),
    };
    delete payload.refund_amount;

    if (isEdit.value) {
      const { data } = await api.patch(`/returns/${route.params.id}`, payload);
      ElMessage.success('退货单已保存');
      router.replace(`/returns/${data.id}`);
    } else {
      const { data } = await api.post('/returns', payload);
      ElMessage.success(`退货单 ${data.return_no} 已创建`);
      router.replace(`/returns/${data.id}`);
    }
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
