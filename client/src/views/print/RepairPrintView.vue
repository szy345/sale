<template>
  <div class="print-page">
    <div class="print-toolbar no-print">
      <div class="left">
        <el-button @click="goBack">
          <el-icon><Back /></el-icon>返回
        </el-button>
        <span class="muted">维修凭证 · {{ repair?.ticket_no || '' }}</span>
        <el-tag v-if="isPreview" type="warning" effect="plain">预览模式（示例数据）</el-tag>
      </div>
      <div class="right">
        <el-select
          v-model="templateId"
          :loading="loadingTemplates"
          placeholder="选择打印模板"
          style="width: 280px"
          @change="selectTemplate"
        >
          <el-option
            v-for="item in templates"
            :key="item.id"
            :label="templateLabel(item)"
            :value="item.id"
          />
        </el-select>
        <span class="copies-control">
          份数
          <el-input-number
            v-model="copies"
            :min="1"
            :max="20"
            size="small"
            controls-position="right"
            style="width: 96px"
          />
        </span>
        <el-button type="primary" :disabled="!template" @click="doPrint">
          <el-icon><Printer /></el-icon>打印当前模板
        </el-button>
      </div>
    </div>

    <div v-if="template" class="print-meta no-print">
      <span>纸张：{{ template.paper_width_mm }} × {{ template.paper_height_mm || '自动' }} mm</span>
      <span>页边距：{{ template.margin_mm }} mm</span>
      <span>维修单号字号：{{ template.ticket_font_size }} px</span>
      <span class="print-meta-tip">虚线内为实际打印内容区域</span>
    </div>

    <div v-if="loading || loadingTemplates" class="voucher" style="text-align: center; padding: 60px">
      <el-icon class="is-loading" :size="28"><Loading /></el-icon>
      <p class="muted">正在加载凭证…</p>
    </div>

    <div v-else-if="error" class="voucher" style="text-align: center; padding: 60px">
      <el-result icon="warning" title="凭证加载失败" :sub-title="error">
        <template #extra>
          <el-button type="primary" @click="router.push('/repairs')">返回维修列表</el-button>
        </template>
      </el-result>
    </div>

    <div v-else-if="!template" class="voucher" style="text-align: center; padding: 60px">
      <el-result icon="warning" title="暂无打印模板" sub-title="请管理员先到“打印设置”添加模板">
        <template #extra>
          <el-button type="primary" @click="router.push('/repairs')">返回维修列表</el-button>
        </template>
      </el-result>
    </div>

    <div v-else class="voucher-copies">
      <div
        v-for="copy in copies"
        :key="copy"
        class="voucher-paper"
        :style="paperStyle"
      >
      <div
        class="voucher"
        :class="{
          'voucher-label': template.layout === 'label',
          receipt: template.layout !== 'label' && template.paper_width_mm <= 80,
        }"
        :style="voucherStyle"
      >
        <template v-if="template.layout === 'label'">
        <div class="label-sheet">
          <div class="label-head">
            <span class="label-shop">{{ brandName }}</span>
            <span class="label-type">维修标签</span>
          </div>
          <div class="label-ticket">{{ repair.ticket_no }}</div>
          <div class="label-main">
            <div class="label-info">
              <div class="label-customer">
                {{ repair.customer_name }}<template v-if="repair.phone"> · {{ repair.phone }}</template>
              </div>
              <div>货号：{{ repair.item_no || '—' }}</div>
              <div>颜色/尺码：{{ [repair.color, repair.size].filter(Boolean).join(' / ') || '—' }}</div>
              <div v-if="template.show_shop_address && shop.address" class="label-address">
                {{ shop.address }}
              </div>
            </div>
            <img
              v-if="template.show_qr && template.qr_size_mm > 0 && qrCode"
              class="label-qr"
              :src="qrCode"
              alt="维修单二维码"
            />
          </div>
          <div v-if="template.show_problem && repair.problem" class="label-problem">
            问题：{{ repair.problem }}
          </div>
          <div v-if="template.show_remark && repair.remark" class="label-remark">
            备注：{{ repair.remark }}
          </div>
        </div>
      </template>

      <template v-else>
        <div class="voucher-head" :class="{ 'voucher-head-centered': isWideVoucher }">
          <div class="voucher-shop">
            <h1>{{ brandName }}</h1>
            <p v-if="template.show_shop_address && shop.address">{{ shop.address }}</p>
            <p v-if="shop.phone">电话：{{ shop.phone }}</p>
            <div class="voucher-type">维 修 凭 证</div>
          </div>
          <div
            v-if="template.show_qr && template.qr_size_mm > 0 && !isNarrowReceipt"
            class="voucher-qr"
          >
            <img v-if="qrCode" :src="qrCode" alt="维修单二维码" />
            <span>扫码查询</span>
          </div>
        </div>

        <div class="voucher-ticket-block">
          <div class="voucher-ticket-label">维修单号</div>
          <div class="voucher-ticket">{{ repair.ticket_no }}</div>
        </div>

        <table class="voucher-table">
          <tr>
            <th>顾客姓名</th>
            <td>{{ repair.customer_name }}</td>
            <th>联系电话</th>
            <td>{{ repair.phone }}</td>
          </tr>
          <tr>
            <th>商品名称</th>
            <td>{{ repair.product_name || '—' }}</td>
            <th>货号</th>
            <td>{{ repair.item_no || '—' }}</td>
          </tr>
          <tr>
            <th>颜色 / 尺码</th>
            <td>{{ [repair.color, repair.size].filter(Boolean).join(' / ') || '—' }}</td>
            <th>登记人</th>
            <td>{{ repair.operator_name }}</td>
          </tr>
          <tr v-if="template.show_problem">
            <th>问题描述</th>
            <td colspan="3" style="white-space: pre-wrap">{{ repair.problem }}</td>
          </tr>
          <tr v-if="template.show_remark">
            <th>备注</th>
            <td colspan="3" style="white-space: pre-wrap">{{ repair.remark || '—' }}</td>
          </tr>
        </table>

        <div v-if="template.show_events && events.length" class="voucher-events">
          <h3>维修流转记录</h3>
          <div v-for="event in events" :key="event.id" class="voucher-event">
            <span>
              第 {{ event.round_no }} 轮 ·
              <template v-if="event.stage === 'customer_picked'">✓ </template>
              {{ STAGE_LABELS[event.stage] || event.stage }}
              <span class="meta">
                · {{ event.event_date }} · 操作人 {{ event.operator_name }}
                <template v-if="event.tracking_no"> · 运单号 {{ event.tracking_no }}</template>
              </span>
            </span>
          </div>
        </div>

        <div class="voucher-remark">
          <strong>特别说明：</strong>
          请顾客凭本凭证提取物品。提取时请当面检查维修效果，妥善保管本凭证。
        </div>

        <div v-if="template.show_signature" class="voucher-foot">
          <div>
            <div>顾客签字：</div>
            <div class="signature">日期：</div>
          </div>
          <div>
            <div>门店经办人：{{ repair.operator_name }}</div>
            <div class="signature">日期：</div>
          </div>
        </div>

        <div v-if="template.paper_height_mm > 0" class="voucher-notice">
          本凭证为{{ brandName }}销售维保系统打印，维修单号可在系统内查询。请妥善保管，取鞋时须出示。
        </div>

        <div
          v-if="isNarrowReceipt && template.show_qr && template.qr_size_mm > 0"
          class="receipt-qr-bottom"
        >
          <img v-if="qrCode" :src="qrCode" alt="维修单二维码" />
          <span>扫码查询</span>
        </div>
      </template>
      </div>
      </div>
    </div>

    <div class="print-hint no-print">
      打印提示：请在浏览器打印窗口中选择对应的标签/小票打印机和纸张尺寸，缩放设为 100%，关闭页眉页脚。
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import QRCode from 'qrcode';
import api, { errorMessage } from '../../api';
import { STAGE_LABELS } from '../../constants';
import { usePrintTemplates } from '../../composables/usePrintTemplates';
import { settings } from '../../stores/settings';
import { today } from '../../utils/format';

const route = useRoute();
const router = useRouter();

const repair = ref(null);
const shop = ref({});
const qrCode = ref('');
const loading = ref(true);
const error = ref('');
const {
  templates,
  templateId,
  template,
  copies,
  loadingTemplates,
  paperStyle,
  voucherStyle,
  loadTemplates,
  selectTemplate,
  applyPageStyle,
  templateLabel,
} = usePrintTemplates();

const isPreview = computed(() => route.query.preview === '1');
const isNarrowReceipt = computed(
  () =>
    template.value?.layout === 'full' && Number(template.value?.paper_width_mm) <= 80,
);
const isWideVoucher = computed(
  () =>
    template.value?.layout === 'full' && Number(template.value?.paper_width_mm) > 80,
);
const brandName = computed(() => shop.value.name || settings.systemName || '销售维保系统');
const events = computed(() => (repair.value?.events || []).filter((event) => !event.voided));

function sampleRepair() {
  return {
    id: 'preview',
    ticket_no: 'WX-20261020-001',
    repair_date: today(),
    customer_name: '张三',
    phone: '13800138000',
    product_name: '女士皮鞋',
    item_no: 'YK-1001',
    color: '黑色',
    size: '38',
    problem: '鞋底开胶，需返厂维修（示例）',
    remark: '示例备注',
    status: 'pending_factory',
    current_round: 1,
    operator_name: '店长',
    created_at: new Date().toISOString(),
    public_token: 'preview',
    events: [],
  };
}

async function load() {
  loading.value = true;
  try {
    if (isPreview.value) {
      const metaResponse = await api.get('/meta').catch(() => ({ data: { shop: {} } }));
      shop.value = metaResponse.data.shop || {};
      repair.value = sampleRepair();
      const baseUrl = metaResponse.data.baseUrl || window.location.origin;
      qrCode.value = await QRCode.toDataURL(
        `${baseUrl}/status/${repair.value.public_token || repair.value.ticket_no}`,
        {
          margin: 1,
          width: 180,
          color: { dark: '#222222', light: '#ffffff' },
        },
      );
      return;
    }

    const [repairResponse, metaResponse] = await Promise.all([
      api.get(`/repairs/${route.params.id}`),
      api.get('/meta').catch(() => ({ data: { shop: {} } })),
    ]);
    repair.value = repairResponse.data;
    shop.value = metaResponse.data.shop || {};
    const baseUrl = metaResponse.data.baseUrl || window.location.origin;
    qrCode.value = await QRCode.toDataURL(
      `${baseUrl}/status/${repair.value.public_token || repair.value.ticket_no}`,
      {
        margin: 1,
        width: 180,
        color: { dark: '#222222', light: '#ffffff' },
      },
    );
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
}

function goBack() {
  if (isPreview.value) {
    router.push('/print-settings');
    return;
  }
  if (window.history.length > 1) router.back();
  else router.push('/repairs');
}

async function doPrint() {
  if (!template.value) return;
  applyPageStyle();
  await nextTick();
  window.print();
}

onMounted(async () => {
  await Promise.all([
    load(),
    loadTemplates()
      .then(() => {
        const requested = Number(route.query.templateId);
        if (requested && templates.value.some((item) => item.id === requested)) {
          selectTemplate(requested);
        }
      })
      .catch((err) => {
        error.value = errorMessage(err);
      }),
  ]);
});
</script>

<style scoped>
.voucher-label {
  overflow: hidden;
}

.label-sheet {
  box-sizing: border-box;
  height: 100%;
  padding: 1.2mm 1.5mm;
  display: flex;
  flex-direction: column;
  gap: 0.8mm;
  overflow: hidden;
}

.label-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 4px;
  font-size: 0.9em;
  line-height: 1.1;
  color: #555;
}

.label-shop {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.label-type {
  flex: 0 0 auto;
  color: #b20f2a;
  font-weight: 700;
}

.label-ticket {
  flex: 0 0 auto;
  font-size: var(--ticket-font-size, 20px);
  line-height: 1;
  font-weight: 900;
  letter-spacing: -0.2px;
  white-space: nowrap;
  color: #111;
}

.label-main {
  display: flex;
  gap: 1.5mm;
  align-items: flex-start;
  min-height: 0;
}

.label-info {
  flex: 1;
  min-width: 0;
  font-size: 1em;
  line-height: 1.35;
  color: #333;
}

.label-customer {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.label-address {
  color: #777;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.label-qr {
  flex: 0 0 auto;
  width: var(--qr-size, 16mm);
  height: auto;
  display: block;
}

.label-problem,
.label-remark {
  font-size: 0.92em;
  line-height: 1.35;
  color: #444;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.print-hint {
  max-width: 860px;
  margin: 16px auto 0;
  padding: 10px 14px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid var(--yk-border);
  color: var(--yk-muted);
  font-size: 12px;
  text-align: center;
}
</style>
