<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>打印设置</h2>
        <p>配置不同纸张和打印机的打印模板，维修单号字号可单独放大</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>新增模板
        </el-button>
      </div>
    </div>

    <el-alert
      title="贴盒标签建议将维修单号字号设为 18-24；80mm 小票建议 24-30；A4 凭证建议 28-36。保存后点击“预览”可用示例数据查看实际效果。"
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    />

    <div class="panel table-panel">
      <div class="table-toolbar">
        <span class="total">共 <strong>{{ items.length }}</strong> 个打印模板</span>
        <el-button text :loading="loading" @click="load">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>

      <el-table v-loading="loading" :data="items" style="width: 100%" row-key="id">
        <el-table-column label="模板名称" min-width="170">
          <template #default="{ row }">
            <strong>{{ row.name }}</strong>
            <el-tag v-if="row.is_default" size="small" type="success" effect="plain" style="margin-left: 6px">
              默认
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="布局" width="130">
          <template #default="{ row }">
            <el-tag :type="row.layout === 'label' ? 'warning' : 'primary'" effect="plain" round>
              {{ layoutLabel(row.layout) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="纸张尺寸" min-width="125">
          <template #default="{ row }">{{ paperLabel(row) }}</template>
        </el-table-column>
        <el-table-column label="维修单号字号" width="130" align="center">
          <template #default="{ row }">
            <strong class="ticket-size">{{ row.ticket_font_size }} px</strong>
          </template>
        </el-table-column>
        <el-table-column label="基础字号" width="95" align="center">
          <template #default="{ row }">{{ row.base_font_size }} px</template>
        </el-table-column>
        <el-table-column label="二维码" width="90" align="center">
          <template #default="{ row }">{{ row.show_qr ? `${row.qr_size_mm} mm` : '不显示' }}</template>
        </el-table-column>
        <el-table-column label="默认份数" width="95" align="center">
          <template #default="{ row }">{{ row.copies || 1 }} 份</template>
        </el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="preview(row)">预览</el-button>
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="!row.is_default" link @click="setDefault(row)">设为默认</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无打印模板" :image-size="90" />
        </template>
      </el-table>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑打印模板' : '新增打印模板'"
      width="700px"
      destroy-on-close
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="模板名称" prop="name">
              <el-input v-model="form.name" maxlength="50" placeholder="例如：50×30mm 盒贴标签" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="布局类型" prop="layout">
              <el-radio-group v-model="form.layout">
                <el-radio
                  v-for="option in PRINT_LAYOUT_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <div class="form-section-title">纸张与字号</div>
        <el-row :gutter="16">
          <el-col :xs="12" :sm="6">
            <el-form-item label="纸张宽度（mm）" prop="paper_width_mm">
              <el-input-number v-model="form.paper_width_mm" :min="20" :max="300" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-form-item label="纸张高度（mm）" prop="paper_height_mm">
              <el-input-number v-model="form.paper_height_mm" :min="0" :max="500" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-form-item label="页边距（mm）" prop="margin_mm">
              <el-input-number v-model="form.margin_mm" :min="0" :max="20" :step="0.5" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-form-item label="二维码尺寸（mm）" prop="qr_size_mm">
              <el-input-number v-model="form.qr_size_mm" :min="0" :max="50" :step="1" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-form-item label="默认打印份数" prop="copies">
              <el-input-number v-model="form.copies" :min="1" :max="20" controls-position="right" style="width: 100%" />
              <div class="muted small field-hint">打印页可临时修改</div>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="维修单号字号（px）" prop="ticket_font_size">
              <el-input-number v-model="form.ticket_font_size" :min="8" :max="72" controls-position="right" style="width: 100%" />
              <div class="muted small field-hint">贴盒标签建议 18-24px，让单号更醒目</div>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="基础字号（px）" prop="base_font_size">
              <el-input-number v-model="form.base_font_size" :min="6" :max="24" controls-position="right" style="width: 100%" />
              <div class="muted small field-hint">其他文字的大小</div>
            </el-form-item>
          </el-col>
        </el-row>
        <div class="muted small field-hint" style="margin-top: -6px">
          纸张高度填 0 表示连续纸/自动高度；标签纸请填写实际高度，例如 30mm。
        </div>

        <div class="form-section-title">显示内容</div>
        <el-row :gutter="16">
          <el-col :xs="12" :sm="8">
            <el-form-item label="显示二维码">
              <el-switch v-model="form.show_qr" />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :sm="8">
            <el-form-item label="显示问题描述">
              <el-switch v-model="form.show_problem" />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :sm="8">
            <el-form-item label="显示备注">
              <el-switch v-model="form.show_remark" />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :sm="8">
            <el-form-item label="显示流转记录">
              <el-switch v-model="form.show_events" />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :sm="8">
            <el-form-item label="显示签字栏">
              <el-switch v-model="form.show_signature" />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :sm="8">
            <el-form-item label="显示门店地址">
              <el-switch v-model="form.show_shop_address" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="默认模板">
          <el-switch v-model="form.is_default" active-text="设为默认" inactive-text="普通模板" />
        </el-form-item>
        <el-alert
          title="盒贴标签一般不需要显示流转记录和签字栏；维修单号建议使用较大字号。"
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
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { errorMessage } from '../api';
import { PRINT_LAYOUT_OPTIONS } from '../constants';

const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const items = ref([]);
const dialogVisible = ref(false);
const editingId = ref(null);
const formRef = ref();

const defaultForm = () => ({
  name: '',
  layout: 'label',
  paper_width_mm: 50,
  paper_height_mm: 30,
  margin_mm: 0,
  ticket_font_size: 20,
  base_font_size: 9,
  qr_size_mm: 16,
  copies: 1,
  show_qr: true,
  show_problem: true,
  show_remark: false,
  show_events: false,
  show_signature: false,
  show_shop_address: false,
  is_default: false,
});

const form = reactive(defaultForm());

const rules = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  layout: [{ required: true, message: '请选择布局类型', trigger: 'change' }],
  paper_width_mm: [{ required: true, message: '请输入纸张宽度', trigger: 'change' }],
  ticket_font_size: [{ required: true, message: '请输入维修单号字号', trigger: 'change' }],
  base_font_size: [{ required: true, message: '请输入基础字号', trigger: 'change' }],
};

function layoutLabel(layout) {
  return layout === 'label' ? '盒贴标签' : '标准凭证';
}

function paperLabel(row) {
  return `${row.paper_width_mm} × ${row.paper_height_mm || '自动'} mm`;
}

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get('/print-templates');
    items.value = data.items;
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  Object.assign(form, defaultForm());
  dialogVisible.value = true;
}

function openEdit(row) {
  editingId.value = row.id;
  Object.assign(form, {
    name: row.name,
    layout: row.layout,
    paper_width_mm: Number(row.paper_width_mm),
    paper_height_mm: Number(row.paper_height_mm),
    margin_mm: Number(row.margin_mm),
    ticket_font_size: Number(row.ticket_font_size),
    base_font_size: Number(row.base_font_size),
    qr_size_mm: Number(row.qr_size_mm),
    copies: Number(row.copies || 1),
    show_qr: row.show_qr,
    show_problem: row.show_problem,
    show_remark: row.show_remark,
    show_events: row.show_events,
    show_signature: row.show_signature,
    show_shop_address: row.show_shop_address,
    is_default: row.is_default,
  });
  dialogVisible.value = true;
}

async function submit() {
  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  saving.value = true;
  try {
    const payload = { ...form };
    if (editingId.value) {
      await api.patch(`/print-templates/${editingId.value}`, payload);
      ElMessage.success('打印模板已保存');
    } else {
      await api.post('/print-templates', payload);
      ElMessage.success('打印模板已新增');
    }
    dialogVisible.value = false;
    await load();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

function preview(row) {
  router.push({
    name: 'repair-print',
    params: { id: 'preview' },
    query: { preview: '1', templateId: row.id },
  });
}

async function setDefault(row) {
  try {
    await api.patch(`/print-templates/${row.id}`, { is_default: true });
    ElMessage.success(`已将“${row.name}”设为默认模板`);
    await load();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除打印模板“${row.name}”吗？`,
      '删除打印模板',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }

  try {
    await api.delete(`/print-templates/${row.id}`);
    ElMessage.success('打印模板已删除');
    await load();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}

onMounted(load);
</script>

<style scoped>
.ticket-size {
  color: var(--yk-red);
}

.field-hint {
  margin-top: 4px;
}
</style>
