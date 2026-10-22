<template>
  <el-tag :type="type" effect="plain" round>{{ label }}</el-tag>
</template>

<script setup>
import { computed } from 'vue';
import { HANDLING_LABELS, HANDLING_TYPES } from '../constants';

const props = defineProps({
  handling: { type: String, required: true },
});

const label = computed(() => HANDLING_LABELS[props.handling] || props.handling);
const type = computed(() => HANDLING_TYPES[props.handling] || 'info');
</script>
