<template>
  <div class="print-page">
    <div class="print-toolbar no-print">
      <div class="left">
        <el-button @click="goBack">
          <el-icon><Back /></el-icon>返回
        </el-button>
        <span class="muted">退货凭证 · {{ item?.return_no || '' }}</span>
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
            v-for="tpl in templates"
            :key="tpl.id"
            :label="templateLabel(tpl)"
            :value="tpl.id"
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
      <span>退货单号字号：{{ template.ticket_font_size }} px</span>
      <span class="print-meta-tip">虚线内为实际打印内容区域</span>
    </div>

    <div v-if="loading || loadingTemplates" class="voucher" style="text-align: center; padding: 60px">
      <el-icon class="is-loading" :size="28"><Loading /></el-icon>
      <p class="muted">正在加载凭证…</p>
    </div>

    <div v-else-if="error" class="voucher" style="text-align: center; padding: 60px">
      <el-result icon="warning" title="凭证加载失败" :sub-title="error">
        <template #extra>
          <el-button type="primary" @click="router.push('/returns')">返回退货列表</el-button>
        </template>
      </el-result>
    </div>

    <div v-else-if="!template" class="voucher" style="text-align: center; padding: 60px">
      <el-result icon="warning" title="暂无打印模板" sub-title="请管理员先到“打印设置”添加模板">
        <template #extra>
          <el-button type="primary" @click="router.push('/returns')">返回退货列表</el-button>
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
            <span class="label-type">退货标签</span>
          </div>
          <div class="label-ticket">{{ item.return_no }}</div>
          <div class="label-main">
            <div class="label-info">
              <div class="label-customer">
                {{ item.customer_name }}<template v-if="item.phone"> · {{ item.phone }}</template>
              </div>
              <div>货号：{{ item.item_no || '—' }}</div>
              <div>颜色/尺码：{{ [item.color, item.size].filter(Boolean).join(' / ') || '—' }}</div>
              <div>
                {{ HANDLING_LABELS[item.handling] || item.handling }}
                <template v-if="item.refund_amount_cents > 0">
                  · ¥{{ centsToYuan(item.refund_amount_cents) }}
                </template>
              </div>
              <div v-if="template.show_shop_address && shop.address" class="label-address">
                {{ shop.address }}
              </div>
            </div>
            <img
              v-if="template.show_qr && template.qr_size_mm > 0 && qrCode"
              class="label-qr"
              :src="qrCode"
              alt="退货单二维码"
            />
          </div>
          <div v-if="template.show_problem && item.reason" class="label-problem">
            原因：{{ item.reason }}
          </div>
          <div v-if="template.show_remark && item.remark" class="label-remark">
            备注：{{ item.remark }}
          </div>
        </div>
      </template>

      <template v-else>
        <div class="voucher-head">
          <div class="voucher-shop">
            <h1>{{ brandName }}</h1>
            <p v-if="template.show_shop_address && shop.address">{{ shop.address }}</p>
            <p v-if="shop.phone">电话：{{ shop.phone }}</p>
            <div class="voucher-type">退 货 凭 证</div>
          </div>
          <div
            v-if="template.show_qr && template.qr_size_mm > 0 && !isNarrowReceipt"
            class="voucher-qr"
          >
            <img v-if="qrCode" :src="qrCode" alt="退货单二维码" />
            <span>扫码查询</span>
          </div>
        </div>

        <div class="voucher-ticket-block">
          <div class="voucher-ticket-label">退货单号</div>
          <div class="voucher-ticket">{{ item.return_no }}</div>
        </div>

        <div class="voucher-no">
          <span>处理方式：{{ HANDLING_LABELS[item.handling] || item.handling }}</span>
        </div>

        <table class="voucher-table">
          <tr>
            <th>顾客姓名</th>
            <td>{{ item.customer_name }}</td>
            <th>联系电话</th>
            <td>{{ item.phone }}</td>
          </tr>
          <tr>
            <th>商品名称</th>
            <td>{{ item.product_name }}</td>
            <th>货号</th>
            <td>{{ item.item_no || '—' }}</td>
          </tr>
          <tr>
            <th>颜色 / 尺码</th>
            <td>{{ [item.color, item.size].filter(Boolean).join(' / ') || '—' }}</td>
            <th>购买日期</th>
            <td>{{ item.purchase_date || '—' }}</td>
          </tr>
          <tr>
            <th>小票号</th>
            <td>{{ item.receipt_no || '—' }}</td>
            <th>金额</th>
            <td>¥{{ centsToYuan(item.refund_amount_cents) }}</td>
          </tr>
          <tr v-if="template.show_problem">
            <th>退货原因</th>
            <td colspan="3" style="white-space: pre-wrap">{{ item.reason }}</td>
          </tr>
          <tr v-if="template.show_remark">
            <th>备注</th>
            <td colspan="3" style="white-space: pre-wrap">{{ item.remark || '—' }}</td>
          </tr>
        </table>

        <div class="voucher-remark">
          <strong>特别说明：</strong>
          {{ HANDLING_LABELS[item.handling] === '退款'
            ? `本次退货按退款处理，退款金额 ¥${centsToYuan(item.refund_amount_cents)}。`
            : `本次退货按${HANDLING_LABELS[item.handling] || item.handling}处理。` }}
          请顾客核对商品及金额，妥善保管本凭证。
        </div>

        <div v-if="template.show_signature" class="voucher-foot">
          <div>
            <div>顾客签字：</div>
            <div class="signature">日期：</div>
          </div>
          <div>
            <div>门店经办人：{{ item.operator_name }}</div>
            <div class="signature">日期：</div>
          </div>
        </div>

        <div v-if="template.paper_height_mm > 0" class="voucher-notice">
          本凭证为{{ brandName }}销售维保系统打印，退货单号可在系统内查询。请妥善保管。
        </div>

        <div
          v-if="isNarrowReceipt && template.show_qr && template.qr_size_mm > 0"
          class="receipt-qr-bottom"
        >
          <img v-if="qrCode" :src="qrCode" alt="退货单二维码" />
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
import { HANDLING_LABELS } from '../../constants';
import { usePrintTemplates } from '../../composables/usePrintTemplates';
import { settings } from '../../stores/settings';
import { centsToYuan } from '../../utils/format';

const route = useRoute();
const router = useRouter();

const item = ref(null);
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

const isNarrowReceipt = computed(
  () =>
    template.value?.layout === 'full' && Number(template.value?.paper_width_mm) <= 80,
);
const brandName = computed(() => shop.value.name || settings.systemName || '销售维保系统');

async function load() {
  loading.value = true;
  try {
    const [itemResponse, metaResponse] = await Promise.all([
      api.get(`/returns/${route.params.id}`),
      api.get('/meta').catch(() => ({ data: { shop: {} } })),
    ]);
    item.value = itemResponse.data;
    shop.value = metaResponse.data.shop || {};
    qrCode.value = await QRCode.toDataURL(`${brandName.value}退货单:${item.value.return_no}`, {
      margin: 1,
      width: 180,
      color: { dark: '#222222', light: '#ffffff' },
    });
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
}

function goBack() {
  if (window.history.length > 1) router.back();
  else router.push('/returns');
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
    loadTemplates().catch((err) => {
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
