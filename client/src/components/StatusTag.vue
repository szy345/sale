<template>
  <el-tag :type="type" effect="light" round :class="['status-tag', `status-${status}`]">
    <el-icon v-if="status === 'customer_picked'"><CircleCheckFilled /></el-icon>
    <span>{{ label }}</span>
  </el-tag>
</template>

<script setup>
import { computed } from 'vue';
import { REPAIR_STATUS_LABELS, REPAIR_STATUS_TYPES } from '../constants';

const props = defineProps({
  status: { type: String, required: true },
});

const label = computed(() => REPAIR_STATUS_LABELS[props.status] || props.status);
const type = computed(() => REPAIR_STATUS_TYPES[props.status] || 'info');
</script>

<style scoped>
.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.status-tag :deep(.el-icon) {
  font-size: 13px;
}

.status-tag.status-pending_factory {
  --el-tag-bg-color: #fff1f2;
  --el-tag-border-color: #fecdd3;
  --el-tag-text-color: #e60012;
  font-weight: 700;
}

.status-tag.status-sent_factory {
  --el-tag-bg-color: #fff4e6;
  --el-tag-border-color: #f5c98b;
  --el-tag-text-color: #d46b08;
  font-weight: 600;
}

.status-tag.status-customer_notified {
  --el-tag-bg-color: #f3e8ff;
  --el-tag-border-color: #d8b4fe;
  --el-tag-text-color: #6d28d9;
}

.status-tag.status-customer_picked {
  --el-tag-bg-color: #15803d;
  --el-tag-border-color: #15803d;
  --el-tag-text-color: #ffffff;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(21, 128, 61, 0.28);
}
</style>
