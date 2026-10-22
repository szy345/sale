<template>
  <el-row :gutter="18">
    <el-col :xs="24" :sm="12" :md="8">
      <el-form-item label="退货日期" prop="return_date">
        <el-date-picker
          v-model="form.return_date"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          style="width: 100%"
        />
      </el-form-item>
    </el-col>
    <el-col :xs="24" :sm="12" :md="8">
      <el-form-item label="顾客姓名" prop="customer_name">
        <el-input v-model="form.customer_name" maxlength="50" placeholder="请输入顾客姓名" />
      </el-form-item>
    </el-col>
    <el-col :xs="24" :sm="12" :md="8">
      <el-form-item label="联系电话" prop="phone">
        <el-input v-model="form.phone" maxlength="30" placeholder="手机号或固定电话" />
      </el-form-item>
    </el-col>
  </el-row>

  <div class="form-section-title">商品信息</div>
  <el-row :gutter="18">
    <el-col :xs="24" :sm="12" :md="8">
      <el-form-item label="商品名称" prop="product_name">
        <el-input v-model="form.product_name" maxlength="100" placeholder="例如：女士皮鞋" />
      </el-form-item>
    </el-col>
    <el-col :xs="24" :sm="12" :md="8">
      <el-form-item label="货号" prop="item_no">
        <el-input v-model="form.item_no" maxlength="100" placeholder="商品货号" />
      </el-form-item>
    </el-col>
    <el-col :xs="12" :sm="6" :md="4">
      <el-form-item label="颜色" prop="color">
        <el-input v-model="form.color" maxlength="50" placeholder="颜色" />
      </el-form-item>
    </el-col>
    <el-col :xs="12" :sm="6" :md="4">
      <el-form-item label="尺码" prop="size">
        <el-input v-model="form.size" maxlength="50" placeholder="尺码" />
      </el-form-item>
    </el-col>
    <el-col :xs="24" :sm="12" :md="8">
      <el-form-item label="购买日期" prop="purchase_date">
        <el-date-picker
          v-model="form.purchase_date"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选填"
          style="width: 100%"
        />
      </el-form-item>
    </el-col>
    <el-col :xs="24" :sm="12" :md="8">
      <el-form-item label="小票号" prop="receipt_no">
        <el-input v-model="form.receipt_no" maxlength="100" placeholder="选填" />
      </el-form-item>
    </el-col>
  </el-row>

  <div class="form-section-title">退货处理</div>
  <el-row :gutter="18">
    <el-col :xs="24" :sm="12" :md="10">
      <el-form-item label="退货原因" prop="reason">
        <el-select
          v-model="form.reason"
          filterable
          allow-create
          default-first-option
          placeholder="选择或输入退货原因"
          style="width: 100%"
        >
          <el-option v-for="reason in REASON_OPTIONS" :key="reason" :label="reason" :value="reason" />
        </el-select>
      </el-form-item>
    </el-col>
    <el-col :xs="24" :sm="12" :md="7">
      <el-form-item label="处理方式" prop="handling">
        <el-select v-model="form.handling" placeholder="请选择" style="width: 100%">
          <el-option
            v-for="option in HANDLING_OPTIONS"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>
    </el-col>
    <el-col :xs="24" :sm="12" :md="7">
      <el-form-item label="退款/差价金额（元）" prop="refund_amount">
        <el-input-number
          v-model="form.refund_amount"
          :min="0"
          :max="1000000"
          :precision="2"
          :step="10"
          controls-position="right"
          style="width: 100%"
        />
      </el-form-item>
    </el-col>
  </el-row>
  <el-form-item label="备注" prop="remark">
    <el-input
      v-model="form.remark"
      type="textarea"
      :rows="3"
      maxlength="2000"
      show-word-limit
      placeholder="选填"
    />
  </el-form-item>
</template>

<script setup>
import { HANDLING_OPTIONS, REASON_OPTIONS } from '../constants';

defineProps({
  form: { type: Object, required: true },
});
</script>
