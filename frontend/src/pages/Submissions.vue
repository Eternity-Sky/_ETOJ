<script setup lang="ts">
import { RouterLink } from "vue-router";
import { ref, onMounted, computed } from "vue";
import {
  api,
  type Submission,
  STATUS_COLOR,
  STATUS_LABEL,
  DIFFICULTY_COLOR,
  DIFFICULTY_LABEL,
  LANGUAGES,
} from "@/lib/api";
import { useToast } from '@/lib/toast'
import UserLink from "@/components/UserLink.vue";

const { success, error: toastError } = useToast()

const items = ref<Submission[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);

// 筛选条件
const filterUser = ref('');
const filterLanguage = ref('');
const filterProblem = ref('');
const filterStatus = ref('');

const totalPages = computed(() => Math.ceil(total.value / pageSize));

async function retest(submissionId: number) {
  try {
    const res = await api.post<any>('/api/submissions/retest', { submissionId })

    success('Rejudge successful')
    // 等待几秒后自动刷新
    setTimeout(() => {
      load() // 刷新列表
    }, 3000)
  } catch (e: any) {
    toastError('Rejudge failed: ' + e.message)
  }
}

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: page.value.toString(),
      pageSize: pageSize.toString(),
    });
    if (filterUser.value) params.append('user', filterUser.value);
    if (filterLanguage.value) params.append('language', filterLanguage.value);
    if (filterProblem.value) params.append('problem', filterProblem.value);
    if (filterStatus.value) params.append('status', filterStatus.value);

    const res = await api.get<any>(`/api/submissions?${params.toString()}`);

    items.value = res.items || [];
    total.value = res.total || 0;
  } catch (e: any) {
    alert('Load failed: ' + e.message)
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  page.value = 1;
  load();
}

function clearFilter() {
  filterUser.value = '';
  filterLanguage.value = '';
  filterProblem.value = '';
  filterStatus.value = '';
  page.value = 1;
  load();
}

onMounted(() => {
  load();
});
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-2xl font-bold flex items-center gap-2">
      <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      评测记录
    </h1>

    <!-- 筛选栏 -->
    <div class="card p-4">
      <div class="flex flex-wrap gap-3 items-end">
        <div class="flex-1 min-w-[150px]">
          <label class="block text-xs text-zinc-400 mb-1">用户</label>
          <input
            v-model="filterUser"
            type="text"
            placeholder="用户..."
            class="input"
          />
        </div>
        <div class="flex-1 min-w-[150px]">
          <label class="block text-xs text-zinc-400 mb-1">语言</label>
          <select v-model="filterLanguage" class="input">
            <option value="">全部语言</option>
            <option v-for="lang in LANGUAGES" :key="lang.value" :value="lang.value">
              {{ lang.label }}
            </option>
          </select>
        </div>
        <div class="flex-1 min-w-[150px]">
          <label class="block text-xs text-zinc-400 mb-1">题目</label>
          <input
            v-model="filterProblem"
            type="text"
            placeholder="题目..."
            class="input"
          />
        </div>
        <div class="flex-1 min-w-[150px]">
          <label class="block text-xs text-zinc-400 mb-1">状态</label>
          <select v-model="filterStatus" class="input">
            <option value="">全部状态</option>
            <option value="pending">pending</option>
            <option value="compiling">compiling</option>
            <option value="running">running</option>
            <option value="accepted">accepted</option>
            <option value="wrong_answer">wrong_answer</option>
            <option value="time_limit_exceeded">time_limit_exceeded</option>
            <option value="memory_limit_exceeded">memory_limit_exceeded</option>
            <option value="compile_error">compile_error</option>
            <option value="system_error">system_error</option>
          </select>
        </div>
        <button @click="applyFilter" class="btn bg-green-600 text-white hover:bg-green-700">
          筛选
        </button>
        <button @click="clearFilter" class="btn bg-zinc-600 text-white hover:bg-zinc-700">
          清除
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="flex flex-col items-center gap-4">
        <div class="w-8 h-8 border-4 border-zinc-600 border-t-blue-500 rounded-full animate-spin"></div>
        <div class="text-zinc-500">加载中...</div>
      </div>
    </div>

    <div v-else class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-zinc-800 border-b border-zinc-700 text-zinc-400">
          <tr>
            <th class="text-left px-4 py-3 font-medium w-24">#</th>
            <th class="text-left px-4 py-3 font-medium">用户</th>
            <th class="text-left px-4 py-3 font-medium">题目</th>
            <th class="text-left px-4 py-3 font-medium w-36">语言</th>
            <th class="text-left px-4 py-3 font-medium w-32">状态</th>
            <th class="text-left px-4 py-3 font-medium w-24 hidden sm:table-cell">分数</th>
            <th class="text-left px-4 py-3 font-medium w-24 hidden sm:table-cell">耗时</th>
            <th class="text-left px-4 py-3 font-medium w-24 hidden sm:table-cell">内存</th>
            <th class="text-left px-4 py-3 font-medium w-44 hidden md:table-cell">提交时间</th>
            <th class="text-right px-4 py-3 font-medium w-20">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="s in items"
            :key="s.id"
            class="border-b border-zinc-700 last:border-0 hover:bg-zinc-750"
          >
            <td class="px-4 py-3">
              <RouterLink
                :to="`/submission/${s.id}`"
                class="text-blue-400 hover:text-blue-300 font-mono text-xs"
                >{{ s.id }}</RouterLink
              >
            </td>
            <td class="px-4 py-3">
              <UserLink
                v-if="s.user_id"
                :user-id="s.user_id"
                :username="s.username || '未知'"
                :avatar-url="s.avatar_url"
                size="sm"
              />
              <span v-else class="font-medium">{{ s.username || '未知' }}</span>
            </td>
            <td class="px-4 py-3">
              <RouterLink
                :to="`/problem/${s.problem_id}`"
                class="text-blue-400 hover:text-blue-300 font-medium"
                >{{ s.problem_title }}</RouterLink
              >
            </td>
            <td class="px-4 py-3 text-zinc-400">{{ s.language }}</td>
            <td class="px-4 py-3">
              <span
                :class="{
                  'text-green-400': s.status === 'accepted',
                  'text-red-400': ['wrong_answer', 'time_limit_exceeded', 'memory_limit_exceeded', 'compile_error'].includes(s.status),
                  'text-orange-400': s.status === 'pending',
                  'text-yellow-400': ['compiling', 'running'].includes(s.status),
                  'text-zinc-400': s.status === 'system_error',
                }"
              >
                {{ STATUS_LABEL[s.status as keyof typeof STATUS_LABEL] || s.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-zinc-400 font-mono text-xs hidden sm:table-cell">
              {{ s.score !== undefined ? `${s.score}/100` : '不可用' }}
            </td>
            <td class="px-4 py-3 text-zinc-400 font-mono text-xs hidden sm:table-cell">
              {{ s.run_time_ms !== undefined ? `${s.run_time_ms}ms` : '-ms' }}
            </td>
            <td class="px-4 py-3 text-zinc-400 font-mono text-xs hidden sm:table-cell">
              {{ s.memory_kb ? `${(s.memory_kb / 1024).toFixed(2)}MB` : '-MB' }}
            </td>
            <td class="px-4 py-3 text-zinc-500 text-xs hidden md:table-cell">
              {{ new Date(s.created_at).toLocaleString('zh-CN') }}
            </td>
            <td class="px-4 py-3 text-right">
              <RouterLink :to="`/submission/${s.id}`" class="text-blue-400 hover:text-blue-300 text-xs">详情</RouterLink>
              <button @click="retest(s.id)" class="text-green-400 hover:text-green-300 text-xs ml-2">重测</button>
            </td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="10" class="px-4 py-10 text-center text-zinc-500">
              暂无提交记录
            </td>
          </tr>
        </tbody>
      </table>
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-between px-4 py-3 border-t border-zinc-700 text-sm"
      >
        <span class="text-zinc-500">共 {{ total }} 条</span>
        <div class="flex items-center gap-1">
          <button
            :disabled="page === 1"
            @click="page--; load();"
            class="btn-outline px-3 py-1.5"
          >
            上一页
          </button>
          <span class="px-3 text-zinc-400">{{ page }} / {{ totalPages }}</span>
          <button
            :disabled="page >= totalPages"
            @click="page++; load();"
            class="btn-outline px-3 py-1.5"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
