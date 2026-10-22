<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>新增维修单</h2>
        <p>登记顾客送修信息，保存后状态为“待返厂维修”</p>
      </div>
      <div class="page-actions">
        <el-button @click="router.back()">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">
          <el-icon><Check /></el-icon>保存维修单
        </el-button>
      </div>
    </div>

    <div class="panel panel-pad">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="submit"
      >
        <RepairFields :form="form" />
        <div class="form-actions">
          <el-button type="primary" :loading="saving" @click="submit">保存维修单</el-button>
          <el-button @click="router.push('/repairs')">返回列表</el-button>
        </div>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api, { errorMessage } from '../../api';
import RepairFields from '../../components/RepairFields.vue';
import { today } from '../../utils/format';

const router = useRouter();
const formRef = ref();
const saving = ref(false);

const form = reactive({
  repair_date: today(),
  customer_name: '',
  phone: '',
  product_id: null,
  product_name: '',
  item_no: '',
  color: '',
  size: '',
  problem: '',
  remark: '',
});

const rules = {
  repair_date: [{ required: true, message: '请选择维修日期', trigger: 'change' }],
  customer_name: [{ required: true, message: '请输入顾客姓名', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入联系电话', trigger: 'blur' },
    {
      pattern: /^[0-9+\-\s()]+$/,
      message: '电话格式不正确',
      trigger: 'blur',
    },
  ],
  problem: [{ required: true, message: '请填写问题描述', trigger: 'blur' }],
};

async function submit() {
  if (saving.value) return;
  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  saving.value = true;
  try {
    const { data } = await api.post('/repairs', { ...form });
    ElMessage.success(`维修单 ${data.ticket_no} 已创建`);
    router.replace(`/repairs/${data.id}`);
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}
</script>
