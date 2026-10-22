<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>账号管理</h2>
        <p>管理员可以创建操作员账号、停用账号和重置密码</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>新增账号
        </el-button>
      </div>
    </div>

    <div class="panel table-panel">
      <div class="table-toolbar">
        <span class="total">共 <strong>{{ users.length }}</strong> 个账号</span>
        <el-button text :loading="loading" @click="load">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>

      <el-table v-loading="loading" :data="users" style="width: 100%" row-key="id">
        <el-table-column prop="username" label="账号" min-width="140">
          <template #default="{ row }">
            <strong>{{ row.username }}</strong>
            <el-tag v-if="row.id === auth.user?.id" size="small" effect="plain" style="margin-left: 6px">
              当前账号
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="display_name" label="姓名" min-width="120" />
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'danger' : 'info'" effect="light" round>
              {{ roleLabel(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'" effect="plain" round>
              {{ row.is_active ? '启用' : '已停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="密码状态" width="115">
          <template #default="{ row }">
            <span :class="row.must_change_password ? 'muted' : ''">
              {{ row.must_change_password ? '待修改初始密码' : '正常' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="155">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button
              link
              :disabled="row.id === auth.user?.id"
              @click="openReset(row)"
            >
              重置密码
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无账号" :image-size="90" />
        </template>
      </el-table>
    </div>

    <el-dialog
      v-model="createDialog"
      title="新增账号"
      width="480px"
      destroy-on-close
      :close-on-click-modal="false"
    >
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-position="top">
        <el-form-item label="账号" prop="username">
          <el-input v-model="createForm.username" maxlength="32" placeholder="字母、数字、下划线" />
        </el-form-item>
        <el-form-item label="姓名" prop="display_name">
          <el-input v-model="createForm.display_name" maxlength="50" placeholder="操作员姓名" />
        </el-form-item>
        <el-form-item label="初始密码" prop="password">
          <el-input v-model="createForm.password" type="password" show-password maxlength="72" />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirm_password">
          <el-input v-model="createForm.confirm_password" type="password" show-password maxlength="72" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-radio-group v-model="createForm.role">
            <el-radio value="operator">操作员</el-radio>
            <el-radio value="admin">管理员</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <el-alert
        title="新账号首次登录后必须修改初始密码。"
        type="info"
        :closable="false"
        show-icon
        style="margin-top: 6px"
      />
      <template #footer>
        <el-button @click="createDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitCreate">创建账号</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="editDialog"
      title="编辑账号"
      width="480px"
      destroy-on-close
      :close-on-click-modal="false"
    >
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-position="top">
        <el-form-item label="账号">
          <el-input :model-value="editingUser?.username" disabled />
        </el-form-item>
        <el-form-item label="姓名" prop="display_name">
          <el-input v-model="editForm.display_name" maxlength="50" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-radio-group v-model="editForm.role" :disabled="editingUser?.id === auth.user?.id">
            <el-radio value="operator">操作员</el-radio>
            <el-radio value="admin">管理员</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="账号状态">
          <el-switch
            v-model="editForm.is_active"
            active-text="启用"
            inactive-text="停用"
            :disabled="editingUser?.id === auth.user?.id"
          />
        </el-form-item>
        <el-alert
          v-if="editingUser?.id === auth.user?.id"
          title="不能停用自己或取消自己的管理员权限。"
          type="warning"
          :closable="false"
          show-icon
        />
      </el-form>
      <template #footer>
        <el-button @click="editDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="resetDialog"
      title="重置密码"
      width="440px"
      destroy-on-close
      :close-on-click-modal="false"
    >
      <p class="muted" style="margin-top: 0">
        账号：<strong>{{ resetUser?.username }}</strong>（{{ resetUser?.display_name }}）
      </p>
      <el-form ref="resetFormRef" :model="resetForm" :rules="resetRules" label-position="top">
        <el-form-item label="新密码" prop="password">
          <el-input v-model="resetForm.password" type="password" show-password maxlength="72" />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirm_password">
          <el-input v-model="resetForm.confirm_password" type="password" show-password maxlength="72" />
        </el-form-item>
      </el-form>
      <el-alert
        title="重置后该账号的登录状态会失效，下次登录必须修改密码。"
        type="warning"
        :closable="false"
        show-icon
      />
      <template #footer>
        <el-button @click="resetDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitReset">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import api, { errorMessage } from '../api';
import { auth } from '../stores/auth';
import { formatDateTime, roleLabel } from '../utils/format';

const loading = ref(false);
const saving = ref(false);
const users = ref([]);

const createDialog = ref(false);
const editDialog = ref(false);
const resetDialog = ref(false);
const editingUser = ref(null);
const resetUser = ref(null);

const createFormRef = ref();
const editFormRef = ref();
const resetFormRef = ref();

const createForm = reactive({
  username: '',
  display_name: '',
  password: '',
  confirm_password: '',
  role: 'operator',
});

const editForm = reactive({
  display_name: '',
  role: 'operator',
  is_active: true,
});

const resetForm = reactive({
  password: '',
  confirm_password: '',
});

const createRules = {
  username: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 3, max: 32, message: '账号长度为 3-32 个字符', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_.-]+$/, message: '账号格式不正确', trigger: 'blur' },
  ],
  display_name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入初始密码', trigger: 'blur' },
    { min: 8, message: '密码至少 8 个字符', trigger: 'blur' },
  ],
  confirm_password: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== createForm.password) callback(new Error('两次输入的密码不一致'));
        else callback();
      },
      trigger: 'blur',
    },
  ],
};

const editRules = {
  display_name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
};

const resetRules = {
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, message: '密码至少 8 个字符', trigger: 'blur' },
  ],
  confirm_password: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== resetForm.password) callback(new Error('两次输入的密码不一致'));
        else callback();
      },
      trigger: 'blur',
    },
  ],
};

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get('/users');
    users.value = data.items;
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  Object.assign(createForm, {
    username: '',
    display_name: '',
    password: '',
    confirm_password: '',
    role: 'operator',
  });
  createDialog.value = true;
}

async function submitCreate() {
  try {
    await createFormRef.value.validate();
  } catch {
    return;
  }
  saving.value = true;
  try {
    await api.post('/users', {
      username: createForm.username,
      display_name: createForm.display_name,
      password: createForm.password,
      role: createForm.role,
    });
    ElMessage.success('账号创建成功，请将初始密码告知使用者');
    createDialog.value = false;
    await load();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

function openEdit(row) {
  editingUser.value = row;
  Object.assign(editForm, {
    display_name: row.display_name,
    role: row.role,
    is_active: row.is_active,
  });
  editDialog.value = true;
}

async function submitEdit() {
  try {
    await editFormRef.value.validate();
  } catch {
    return;
  }
  saving.value = true;
  try {
    await api.patch(`/users/${editingUser.value.id}`, {
      display_name: editForm.display_name,
      role: editForm.role,
      is_active: editForm.is_active,
    });
    ElMessage.success('账号信息已保存');
    editDialog.value = false;
    await load();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

function openReset(row) {
  resetUser.value = row;
  resetForm.password = '';
  resetForm.confirm_password = '';
  resetDialog.value = true;
}

async function submitReset() {
  try {
    await resetFormRef.value.validate();
  } catch {
    return;
  }
  saving.value = true;
  try {
    await api.post(`/users/${resetUser.value.id}/reset-password`, {
      password: resetForm.password,
    });
    ElMessage.success('密码已重置');
    resetDialog.value = false;
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
