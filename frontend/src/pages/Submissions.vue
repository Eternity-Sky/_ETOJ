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
} from "@/lib/api";
import { useToast } from '@/lib/toast'

const { success, error: toastError } = useToast()

const items = ref<Submission[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const judgeHealth = ref<any>(null);
const healthLoading = ref(false);

const totalPages = computed(() => Math.ceil(total.value / pageSize));

const averageRunTime = computed(() => {
  const completedSubmissions = items.value.filter(s => 
    s.status !== 'pending' && s.status !== 'judging' && s.run_time_ms !== null && s.run_time_ms !== undefined
  );
  
  if (completedSubmissions.length === 0) return null;
  
  const totalTime = completedSubmissions.reduce((sum, s) => sum + (s.run_time_ms || 0), 0);
  return Math.round(totalTime / completedSubmissions.length);
});

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
    const res = await api.get<any>(
      `/api/submissions?page=${page.value}&pageSize=${pageSize}`,
    );
    
    items.value = res.items || [];
    total.value = res.total || 0;
  } catch (e: any) {
    alert('Load failed: ' + e.message)
  } finally {
    loading.value = false
  }
}

async function loadJudgeHealth() {
  try {
    healthLoading.value = true;
    const health = await api.get('/api/judge/health');
    judgeHealth.value = health;
  } catch (e: any) {
    console.error('Failed to get judge status:', e);
  } finally {
    healthLoading.value = false;
  }
}

onMounted(() => {
  load();
  loadJudgeHealth();
  // 每30秒更新一次健康状态
  setInterval(loadJudgeHealth, 30000);
});
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-2xl font-bold">提交记录</h1>
    
    <!-- 评测机健康状态 -->
    <div v-if="judgeHealth" class="card p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div 
            :class="[
              'w-3 h-3 rounded-full',
              judgeHealth.status === 'healthy' ? 'bg-emerald-500' :
              judgeHealth.status === 'running' ? 'bg-blue-500' :
              judgeHealth.status === 'queued' ? 'bg-yellow-500' :
              judgeHealth.status === 'error' ? 'bg-red-500' : 'bg-zinc-500'
            ]"
          ></div>
          <span class="font-medium">{{ judgeHealth.message }}</span>
        </div>
        <div class="text-sm text-zinc-500">
          <span v-if="averageRunTime !== null" class="mr-4">
            平均运行时间: {{ averageRunTime }}ms
          </span>
          <span v-if="judgeHealth.latency !== null">
            延迟: {{ judgeHealth.latency }}ms
          </span>
          <span v-if="judgeHealth.runId" class="ml-4">
            <a 
              :href="`https://github.com/Eternity-Sky/_ETOJ/actions/runs/${judgeHealth.runId}`"
              target="_blank"
              class="text-blue-600 hover:text-blue-700"
            >
              最新运行 #{{ judgeHealth.runId }}
            </a>
          </span>
        </div>
      </div>
    </div>
    
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="flex flex-col items-center gap-4">
        <div class="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
        <div class="text-zinc-500">加载中...</div>
      </div>
    </div>
    
    <div v-else class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-zinc-50 border-b border-zinc-200 text-zinc-600">
          <tr>
            <th class="text-left px-4 py-3 font-medium w-24">#</th>
            <th class="text-left px-4 py-3 font-medium">用户</th>
            <th class="text-left px-4 py-3 font-medium">题目</th>
            <th class="text-left px-4 py-3 font-medium w-36">语言</th>
            <th class="text-left px-4 py-3 font-medium w-32">状态</th>
            <th
              class="text-right px-4 py-3 font-medium w-24 hidden sm:table-cell"
            >
              用时
            </th>
            <th
              class="text-right px-4 py-3 font-medium w-24 hidden sm:table-cell"
            >
              内存
            </th>
            <th
              class="text-right px-4 py-3 font-medium w-44 hidden md:table-cell"
            >
              提交时间
            </th>
            <th
              class="text-right px-4 py-3 font-medium w-32 hidden lg:table-cell"
            >
              GitHub Actions
            </th>
            <th
              class="text-right px-4 py-3 font-medium w-24 hidden lg:table-cell"
            >
              评测延迟
            </th>
            <th class="text-right px-4 py-3 font-medium w-20">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="s in items"
            :key="s.id"
            class="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50"
          >
            <td class="px-4 py-3">
              <RouterLink
                :to="`/submission/${s.id}`"
                class="link font-mono text-xs"
                >#{{ s.id }}</RouterLink
              >
            </td>
            <td class="px-4 py-3">
              <span class="font-medium">{{ s.username || '未知' }}</span>
            </td>
            <td class="px-4 py-3">
              <RouterLink
                :to="`/problem/${s.problem_id}`"
                class="link font-medium"
                >{{ s.problem_title }}</RouterLink
              >
            </td>
            <td class="px-4 py-3 text-zinc-600 uppercase">{{ s.language }}</td>
            <td class="px-4 py-3">
              <span
                :class="[
                  'tag',
                  STATUS_COLOR[s.status as keyof typeof STATUS_COLOR],
                ]"
                >{{
                  STATUS_LABEL[s.status as keyof typeof STATUS_LABEL] ||
                  s.status
                }}</span
              >
            </td>
            <td
              class="px-4 py-3 text-right text-zinc-600 font-mono text-xs hidden sm:table-cell"
            >
              {{ s.run_time_ms ?? "-" }} ms
            </td>
            <td
              class="px-4 py-3 text-right text-zinc-600 font-mono text-xs hidden sm:table-cell"
            >
              {{ s.memory_kb ? (s.memory_kb / 1024).toFixed(1) + " MB" : "-" }}
            </td>
            <td
              class="px-4 py-3 text-right text-zinc-500 text-xs hidden md:table-cell"
            >
              {{ new Date(s.created_at).toLocaleString() }}
            </td>
            <td
              class="px-4 py-3 text-right text-zinc-500 text-xs hidden lg:table-cell"
            >
              <a 
                v-if="s.github_run_id"
                :href="`https://github.com/Eternity-Sky/_ETOJ/actions/runs/${s.github_run_id}`"
                target="_blank"
                class="text-blue-600 hover:text-blue-700 font-mono"
              >
                #{{ s.github_run_id }}
              </a>
              <span v-else class="text-zinc-400">-</span>
            </td>
            <td
              class="px-4 py-3 text-right text-zinc-500 text-xs hidden lg:table-cell"
            >
              <span v-if="s.judge_latency_ms !== null && s.judge_latency_ms !== undefined">
                {{ s.judge_latency_ms }}ms
              </span>
              <span v-else class="text-zinc-400">-</span>
            </td>
            <td class="px-4 py-3 text-right">
              <RouterLink :to="`/submission/${s.id}`" class="btn-ghost text-blue-600 hover:text-blue-700 text-xs">详情</RouterLink>
              <button @click="retest(s.id)" class="btn-ghost text-green-600 hover:text-green-700 text-xs ml-2">重测</button>
            </td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="11" class="px-4 py-10 text-center text-zinc-500">
              暂无提交记录
            </td>
          </tr>
        </tbody>
      </table>
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-between px-4 py-3 border-t border-zinc-100 text-sm"
      >
        <span class="text-zinc-500">共 {{ total }} 条</span>
        <div class="flex items-center gap-1">
          <button
            :disabled="page === 1"
            @click="
              page--;
              load();
            "
            class="btn-outline px-3 py-1.5"
          >
            上一页
          </button>
          <span class="px-3 text-zinc-600">{{ page }} / {{ totalPages }}</span>
          <button
            :disabled="page >= totalPages"
            @click="
              page++;
              load();
            "
            class="btn-outline px-3 py-1.5"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
