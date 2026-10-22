<template>
  <div class="page">
    <div v-if="loadError" class="panel panel-pad">
      <el-result icon="warning" title="维修单不存在或已被删除" sub-title="请返回维修列表重新选择">
        <template #extra>
          <el-button type="primary" @click="router.push('/repairs')">返回列表</el-button>
        </template>
      </el-result>
    </div>

    <el-skeleton v-else :loading="loading" animated :rows="8">
      <template #default>
        <template v-if="repair">
          <div class="page-header">
            <div>
              <div class="detail-title-row">
                <h2 class="detail-no">{{ repair.ticket_no }}</h2>
                <StatusTag :status="repair.status" />
                <el-tag v-if="repair.current_round > 1" type="warning" effect="plain" round>
                  第 {{ repair.current_round }} 轮
                </el-tag>
              </div>
              <p>登记人：{{ repair.operator_name }} · 创建于 {{ formatDateTime(repair.created_at) }}</p>
            </div>
            <div class="page-actions">
              <el-button @click="router.push('/repairs')">
                <el-icon><Back /></el-icon>返回列表
              </el-button>
              <el-button @click="router.push(`/print/repair/${repair.id}`)">
                <el-icon><Printer /></el-icon>打印凭证
              </el-button>
              <el-button @click="openEdit">
                <el-icon><Edit /></el-icon>编辑信息
              </el-button>
              <el-dropdown v-if="isAdmin" trigger="click" @command="handleAdminCommand">
                <el-button>
                  更多<el-icon><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="undo">撤销最近一次状态</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>删除维修单</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <div
            class="status-banner"
            :class="{ 'status-banner-completed': repair.status === 'customer_picked' }"
          >
            <div class="status-main">
              <span
                class="status-dot"
                :class="{ 'status-dot-completed': repair.status === 'customer_picked' }"
              >
                <el-icon v-if="repair.status === 'customer_picked'"><CircleCheckFilled /></el-icon>
              </span>
              <div>
                <h3>
                  当前状态：{{ REPAIR_STATUS_LABELS[repair.status] }}
                  <el-tag
                    v-if="repair.status === 'customer_picked'"
                    type="success"
                    effect="dark"
                    round
                    class="completed-inline-tag"
                  >
                    已完成
                  </el-tag>
                </h3>
                <p>
                  第 {{ repair.current_round }} 轮
                  <span v-if="latestEvent"> · 最近更新 {{ latestEvent.event_date }}</span>
                  <span v-if="repair.status === 'customer_picked'"> · 该轮维修已完成</span>
                </p>
              </div>
            </div>
            <div class="page-actions">
              <el-button
                v-if="nextStage"
                type="primary"
                size="large"
                @click="openStatus(nextStage)"
              >
                <el-icon><Check /></el-icon>{{ STAGE_ACTIONS[nextStage] }}
              </el-button>
              <el-button v-if="canRework" size="large" @click="openRework">
                <el-icon><RefreshRight /></el-icon>再次返厂
              </el-button>
            </div>
          </div>

          <div class="panel panel-pad" style="margin-bottom: 16px">
            <div class="info-grid">
              <div class="info-item">
                <div class="label">维修日期</div>
                <div class="value">{{ repair.repair_date }}</div>
              </div>
              <div class="info-item">
                <div class="label">顾客姓名</div>
                <div class="value">{{ repair.customer_name }}</div>
              </div>
              <div class="info-item">
                <div class="label">联系电话</div>
                <div class="value phone">{{ repair.phone }}</div>
              </div>
              <div class="info-item">
                <div class="label">商品名称</div>
                <div class="value">{{ repair.product_name || '—' }}</div>
              </div>
              <div class="info-item">
                <div class="label">货号</div>
                <div class="value">{{ repair.item_no || '—' }}</div>
              </div>
              <div class="info-item">
                <div class="label">颜色 / 尺码</div>
                <div class="value">{{ [repair.color, repair.size].filter(Boolean).join(' / ') || '—' }}</div>
              </div>
              <div class="info-item full">
                <div class="label">问题描述</div>
                <div class="value" style="white-space: pre-wrap">{{ repair.problem }}</div>
              </div>
              <div class="info-item full">
                <div class="label">备注</div>
                <div class="value" style="white-space: pre-wrap">{{ repair.remark || '—' }}</div>
              </div>
            </div>
          </div>

          <div class="panel panel-pad">
            <div class="panel-header" style="padding: 0 0 16px; margin-bottom: 18px">
              <h3>状态流转记录</h3>
              <span class="muted small">每轮最多四条状态记录，再次返厂会开启新一轮</span>
            </div>

            <div v-for="round in rounds" :key="round.round" class="timeline-round">
              <div class="round-title">
                第 {{ round.round }} 轮
                <el-tag v-if="round.round === repair.current_round" size="small" effect="plain">
                  当前轮次
                </el-tag>
              </div>
              <el-timeline>
                <el-timeline-item
                  v-for="event in round.events"
                  :key="event.id"
                  :timestamp="event.event_date"
                  :color="eventColor(event.stage)"
                  :hollow="event.voided"
                >
                  <div class="timeline-event" :class="{ 'voided-event': event.voided }">
                    <div class="event-head">
                      <span
                        class="event-stage"
                        :class="{ 'event-stage-completed': event.stage === 'customer_picked' }"
                      >
                        <el-icon v-if="event.stage === 'customer_picked'">
                          <CircleCheckFilled />
                        </el-icon>
                        {{ stageLabel(event.stage) }}
                      </span>
                      <el-tag v-if="event.voided" size="small" type="info" effect="plain">
                        已撤销
                      </el-tag>
                    </div>
                    <div class="event-meta">
                      <span>操作人：{{ event.operator_name || '—' }}</span>
                      <span v-if="event.tracking_no">运单号：{{ event.tracking_no }}</span>
                      <span v-if="event.created_at">记录：{{ formatDateTime(event.created_at) }}</span>
                      <span v-if="event.voided && event.voided_by_name">
                        撤销人：{{ event.voided_by_name }}
                      </span>
                    </div>
                    <div v-if="event.remark" class="event-remark">{{ event.remark }}</div>
                  </div>
                </el-timeline-item>
              </el-timeline>
            </div>
          </div>
        </template>
      </template>
    </el-skeleton>

    <el-dialog
      v-model="dialog.visible"
      :title="dialog.title"
      width="520px"
      destroy-on-close
      :close-on-click-modal="false"
    >
      <el-form :model="actionForm" label-position="top">
        <el-form-item label="操作日期" required>
          <el-date-picker
            v-model="actionForm.event_date"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item
          v-if="showTrackingField"
          :label="dialog.stage === 'factory_returned' ? '寄回运单号' : '返厂运单号'"
          :required="dialog.stage === 'sent_factory'"
        >
          <el-input
            v-model="actionForm.tracking_no"
            maxlength="100"
            :placeholder="dialog.stage === 'sent_factory' ? '请输入寄往厂家的运单号' : '选填'"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="actionForm.remark"
            type="textarea"
            :rows="3"
            maxlength="2000"
            show-word-limit
            placeholder="选填"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitAction">
          确认提交
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="editVisible"
      title="编辑维修单信息"
      width="820px"
      destroy-on-close
      :close-on-click-modal="false"
    >
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editRules"
        label-position="top"
      >
        <RepairFields :form="editForm" />
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSaving" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { errorMessage } from '../../api';
import RepairFields from '../../components/RepairFields.vue';
import StatusTag from '../../components/StatusTag.vue';
import {
  NEXT_STAGE,
  REPAIR_STATUS_COLORS,
  REPAIR_STATUS_LABELS,
  STAGE_ACTIONS,
  STAGE_LABELS,
} from '../../constants';
import { auth } from '../../stores/auth';
import { formatDateTime, today } from '../../utils/format';

const route = useRoute();
const router = useRouter();

const repair = ref(null);
const loading = ref(true);
const loadError = ref(false);
const submitting = ref(false);
const editVisible = ref(false);
const editSaving = ref(false);
const editFormRef = ref();

const isAdmin = computed(() => auth.user?.role === 'admin');
const nextStage = computed(() => (repair.value ? NEXT_STAGE[repair.value.status] : null));
const canRework = computed(() =>
  ['factory_returned', 'customer_picked'].includes(repair.value?.status),
);
const latestEvent = computed(() => {
  const events = (repair.value?.events || []).filter((event) => !event.voided);
  return events.length ? events[events.length - 1] : null;
});

const roundEvents = computed(() => {
  if (!repair.value) return [];
  const events = repair.value.events.filter((event) => isAdmin.value || !event.voided);
  const map = new Map();
  for (const event of events) {
    if (!map.has(event.round_no)) map.set(event.round_no, []);
    map.get(event.round_no).push(event);
  }
  const maxRound = Math.max(1, Number(repair.value.current_round) || 1, ...map.keys());
  const result = [];
  for (let round = 1; round <= maxRound; round += 1) {
    const list = (map.get(round) || []).sort((a, b) => a.id - b.id);
    if (round === 1) {
      list.unshift({
        id: 'initial',
        stage: 'pending_factory',
        event_date: repair.value.repair_date,
        operator_name: repair.value.operator_name,
        created_at: repair.value.created_at,
        remark: null,
        initial: true,
      });
    }
    result.push({ round, events: list });
  }
  return result;
});
const rounds = roundEvents;

const dialog = reactive({
  visible: false,
  mode: 'status',
  stage: '',
  title: '',
});
const showTrackingField = computed(
  () => !['customer_notified', 'customer_picked'].includes(dialog.stage),
);
const actionForm = reactive({
  event_date: today(),
  tracking_no: '',
  remark: '',
});

const editKeys = [
  'repair_date',
  'customer_name',
  'phone',
  'product_id',
  'product_name',
  'item_no',
  'color',
  'size',
  'problem',
  'remark',
];
const editForm = reactive({
  ...Object.fromEntries(editKeys.map((key) => [key, ''])),
  product_id: null,
});

const editRules = {
  repair_date: [{ required: true, message: '请选择维修日期', trigger: 'change' }],
  customer_name: [{ required: true, message: '请输入顾客姓名', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入联系电话', trigger: 'blur' },
    { pattern: /^[0-9+\-\s()]+$/, message: '电话格式不正确', trigger: 'blur' },
  ],
  problem: [{ required: true, message: '请填写问题描述', trigger: 'blur' }],
};

function stageLabel(stage) {
  if (stage === 'pending_factory') return '待返厂维修';
  return STAGE_LABELS[stage] || stage;
}

function eventColor(stage) {
  return REPAIR_STATUS_COLORS[stage] || '#409eff';
}

async function load() {
  loading.value = true;
  loadError.value = false;
  try {
    const { data } = await api.get(`/repairs/${route.params.id}`);
    repair.value = data;
  } catch (error) {
    if (error.response?.status === 404) loadError.value = true;
    else ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

function resetActionForm() {
  actionForm.event_date = today();
  actionForm.tracking_no = '';
  actionForm.remark = '';
}

function openStatus(stage) {
  dialog.mode = 'status';
  dialog.stage = stage;
  dialog.title = STAGE_ACTIONS[stage] || REPAIR_STATUS_LABELS[stage];
  resetActionForm();
  dialog.visible = true;
}

function openRework() {
  dialog.mode = 'rework';
  dialog.stage = 'sent_factory';
  dialog.title = `再次返厂（第 ${Number(repair.value.current_round) + 1} 轮）`;
  resetActionForm();
  dialog.visible = true;
}

async function submitAction() {
  if (!actionForm.event_date) {
    ElMessage.warning('请选择操作日期');
    return;
  }
  if (dialog.stage === 'sent_factory' && !actionForm.tracking_no.trim()) {
    ElMessage.warning('请填写返厂运单号');
    return;
  }

  submitting.value = true;
  try {
    const payload = {
      event_date: actionForm.event_date,
      tracking_no: actionForm.tracking_no.trim() || null,
      remark: actionForm.remark || null,
    };
    const url =
      dialog.mode === 'rework'
        ? `/repairs/${repair.value.id}/rework`
        : `/repairs/${repair.value.id}/status`;
    if (dialog.mode === 'status') payload.stage = dialog.stage;

    const { data } = await api.post(url, payload);
    repair.value = data;
    dialog.visible = false;
    ElMessage.success(
      dialog.mode === 'rework'
        ? `已开启第 ${data.current_round} 轮返厂维修`
        : '状态已更新',
    );
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    submitting.value = false;
  }
}

function openEdit() {
  for (const key of editKeys) {
    editForm[key] = key === 'product_id' ? repair.value[key] ?? null : repair.value[key] ?? '';
  }
  editVisible.value = true;
}

async function submitEdit() {
  if (editSaving.value) return;
  try {
    await editFormRef.value.validate();
  } catch {
    return;
  }

  editSaving.value = true;
  try {
    const payload = {};
    for (const key of editKeys) payload[key] = editForm[key];
    const { data } = await api.patch(`/repairs/${repair.value.id}`, payload);
    repair.value = data;
    editVisible.value = false;
    ElMessage.success('维修单信息已保存');
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    editSaving.value = false;
  }
}

async function handleAdminCommand(command) {
  if (command === 'undo') {
    try {
      await ElMessageBox.confirm(
        '撤销最近一次状态变更后，维修状态和轮次会自动回退。确定继续吗？',
        '撤销状态',
        { confirmButtonText: '撤销', cancelButtonText: '取消', type: 'warning' },
      );
    } catch {
      return;
    }
    try {
      const { data } = await api.post(`/repairs/${repair.value.id}/undo-last`);
      repair.value = data;
      ElMessage.success('已撤销最近一次状态变更');
    } catch (error) {
      ElMessage.error(errorMessage(error));
    }
    return;
  }

  if (command === 'delete') {
    try {
      await ElMessageBox.confirm(
        `确定删除维修单 ${repair.value.ticket_no} 吗？删除后无法恢复。`,
        '删除维修单',
        { confirmButtonText: '删除', cancelButtonText: '取消', type: 'error' },
      );
    } catch {
      return;
    }
    try {
      await api.delete(`/repairs/${repair.value.id}`);
      ElMessage.success('维修单已删除');
      router.replace('/repairs');
    } catch (error) {
      ElMessage.error(errorMessage(error));
    }
  }
}

onMounted(load);
</script>

<style scoped>
.status-banner-completed {
  background: linear-gradient(135deg, #f0fdf4, #dcfce7);
  border-color: #bbf7d0;
}

.status-banner-completed h3 {
  color: #166534;
}

.status-dot {
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-dot-completed {
  width: 26px;
  height: 26px;
  flex-basis: 26px;
  background: #15803d;
  color: #fff;
  box-shadow: 0 0 0 6px rgba(21, 128, 61, 0.13);
}

.status-dot-completed .el-icon {
  font-size: 17px;
}

.completed-inline-tag {
  margin-left: 8px;
  vertical-align: middle;
}

.event-stage {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.event-stage-completed {
  color: #15803d;
}
</style>
