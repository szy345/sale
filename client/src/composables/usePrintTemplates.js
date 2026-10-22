import { computed, onUnmounted, ref, watch } from 'vue';
import api from '../api';

const STYLE_ID = 'voucher-page-style';

export function usePrintTemplates() {
  const templates = ref([]);
  const templateId = ref(null);
  const loadingTemplates = ref(false);
  const copies = ref(1);

  const template = computed(
    () =>
      templates.value.find((item) => item.id === templateId.value) ||
      templates.value.find((item) => item.is_default) ||
      templates.value[0] ||
      null,
  );

  watch(
    template,
    (current) => {
      copies.value = Math.min(20, Math.max(1, Number(current?.copies) || 1));
    },
    { immediate: true },
  );

  const paperStyle = computed(() => {
    const current = template.value;
    if (!current) return {};
    const height = Number(current.paper_height_mm) > 0 ? `${current.paper_height_mm}mm` : null;
    return {
      width: `${current.paper_width_mm}mm`,
      ...(height ? { minHeight: height } : {}),
      padding: `${current.margin_mm}mm`,
      '--page-margin': `${current.margin_mm}mm`,
    };
  });

  const voucherStyle = computed(() => {
    const current = template.value;
    if (!current) return {};
    const width = Math.max(0, Number(current.paper_width_mm) - Number(current.margin_mm) * 2);
    const height =
      Number(current.paper_height_mm) > 0
        ? Math.max(0, Number(current.paper_height_mm) - Number(current.margin_mm) * 2)
        : null;

    return {
      width: `${width}mm`,
      ...(height && current.layout === 'label'
        ? { height: `calc(${height}mm - 0.2mm)`, minHeight: '0mm' }
        : {}),
      padding: '0',
      fontSize: `${current.base_font_size}px`,
      '--voucher-font-size': `${current.base_font_size}px`,
      '--ticket-font-size': `${current.ticket_font_size}px`,
      '--qr-size': `${current.qr_size_mm}mm`,
    };
  });

  function applyPageStyle() {
    const current = template.value;
    if (!current) return;

    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    style.textContent =
      Number(current.paper_height_mm) > 0
        ? `@page { size: ${current.paper_width_mm}mm ${current.paper_height_mm}mm; margin: ${current.margin_mm}mm; }`
        : `@page { margin: ${current.margin_mm}mm; }`;
  }

  async function loadTemplates() {
    loadingTemplates.value = true;
    try {
      const { data } = await api.get('/print-templates');
      templates.value = data.items || [];
      const preferred =
        templates.value.find((item) => item.is_default) || templates.value[0] || null;
      templateId.value = preferred?.id ?? null;
      applyPageStyle();
    } finally {
      loadingTemplates.value = false;
    }
  }

  function selectTemplate(id) {
    templateId.value = id;
    applyPageStyle();
  }

  function templateLabel(item) {
    return `${item.name}（${item.paper_width_mm}×${item.paper_height_mm || '自动'}mm）`;
  }

  onUnmounted(() => {
    document.getElementById(STYLE_ID)?.remove();
  });

  return {
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
  };
}
