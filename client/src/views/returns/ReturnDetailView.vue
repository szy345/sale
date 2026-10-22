<template>
  <div class="page">
    <div v-if="loadError" class="panel panel-pad">
      <el-result icon="warning" title="退货单不存在或已被删除" sub-title="请返回退货列表重新选择">
        <template #extra>
          <el-button type="primary" @click="router.push('/returns')">返回列表</el-button>
        </template>
      </el-result>
    </div>

    <el-skeleton v-else :loading="loading" animated :rows="8">
      <template #default>
        <template v-if="item">
          <div class="page-header">
            <div>
              <div class="detail-title-row">
                <h2 class="detail-no">{{ item.return_no }}</h2>
                <HandlingTag :handling="item.handling" />
              </div>
              <p>登记人：{{ item.operator_name }} · 创建于 {{ formatDateTime(item.created_at) }}</p>
            </div>
            <div class="page-actions">
              <el-button @click="router.push('/returns')">
                <el-icon><Back /></el-icon>返回列表
              </el-button>
              <el-button @click="router.push(`/print/return/${item.id}`)">
                <el-icon><Printer /></el-icon>打印凭证
              </el-button>
              <el-button type="primary" @click="router.push(`/returns/${item.id}/edit`)">
                <el-icon><Edit /></el-icon>编辑
              </el-button>
              <el-button v-if="isAdmin" type="danger" plain @click="remove">
                <el-icon><Delete /></el-icon>删除
              </el-button>
            </div>
          </div>

          <div class="panel panel-pad">
            <div class="info-grid">
              <div class="info-item">
                <div class="label">退货日期</div>
                <div class="value">{{ item.return_date }}</div>
              </div>
              <div class="info-item">
                <div class="label">顾客姓名</div>
                <div class="value">{{ item.customer_name }}</div>
              </div>
              <div class="info-item">
                <div class="label">联系电话</div>
                <div class="value phone">{{ item.phone }}</div>
              </div>
              <div class="info-item">
                <div class="label">商品名称</div>
                <div class="value">{{ item.product_name }}</div>
              </div>
              <div class="info-item">
                <div class="label">货号</div>
                <div class="value">{{ item.item_no || '—' }}</div>
              </div>
              <div class="info-item">
                <div class="label">颜色 / 尺码</div>
                <div class="value">{{ [item.color, item.size].filter(Boolean).join(' / ') || '—' }}</div>
              </div>
              <div class="info-item">
                <div class="label">购买日期</div>
                <div class="value">{{ item.purchase_date || '—' }}</div>
              </div>
              <div class="info-item">
                <div class="label">小票号</div>
                <div class="value">{{ item.receipt_no || '—' }}</div>
              </div>
              <div class="info-item">
                <div class="label">处理方式</div>
                <div class="value">{{ HANDLING_LABELS[item.handling] || item.handling }}</div>
              </div>
              <div class="info-item">
                <div class="label">退款/差价金额</div>
                <div class="value money">¥{{ centsToYuan(item.refund_amount_cents) }}</div>
              </div>
              <div class="info-item">
                <div class="label">退货原因</div>
                <div class="value">{{ item.reason }}</div>
              </div>
              <div class="info-item">
                <div class="label">登记人</div>
                <div class="value">{{ item.operator_name }}</div>
              </div>
              <div class="info-item full">
                <div class="label">备注</div>
                <div class="value" style="white-space: pre-wrap">{{ item.remark || '—' }}</div>
              </div>
            </div>
          </div>
        </template>
      </template>
    </el-skeleton>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { errorMessage } from '../../api';
import HandlingTag from '../../components/HandlingTag.vue';
import { HANDLING_LABELS } from '../../constants';
import { auth } from '../../stores/auth';
import { centsToYuan, formatDateTime } from '../../utils/format';

const route = useRoute();
const router = useRouter();

const item = ref(null);
const loading = ref(true);
const loadError = ref(false);
const isAdmin = computed(() => auth.user?.role === 'admin');

async function load() {
  loading.value = true;
  loadError.value = false;
  try {
    const { data } = await api.get(`/returns/${route.params.id}`);
    item.value = data;
  } catch (error) {
    if (error.response?.status === 404) loadError.value = true;
    else ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

async function remove() {
  try {
    await ElMessageBox.confirm(
      `确定删除退货单 ${item.value.return_no} 吗？删除后无法恢复。`,
      '删除退货单',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'error' },
    );
  } catch {
    return;
  }

  try {
    await api.delete(`/returns/${item.value.id}`);
    ElMessage.success('退货单已删除');
    router.replace('/returns');
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}

onMounted(load);
</script>
