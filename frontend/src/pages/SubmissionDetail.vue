<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ref, onMounted, computed } from 'vue'
import { api, type Submission, STATUS_COLOR, STATUS_LABEL, LANGUAGES } from '@/lib/api'

const props = defineProps<{ id: string }>()
const sub = ref<Submission | null>(null)
const cases = ref<any[]>([])

const langLabel = computed(() => LANGUAGES.find(l => l.value === sub.value?.language)?.label || sub.value?.language)

const parsedResult = computed(() => {
  if (!sub.value?.result_json) return null
  try { return JSON.parse(sub.value.result_json) } catch { return null }
})

async function load() {
  sub.value = await api.get(`/api/submissions/${props.id}`)
  cases.value = parsedResult.value?.details || []
}

onMounted(load)
</script>

<template>
  <div v-if="sub" class="space-y-5">
    <div class="flex flex-wrap items-center gap-3">
      <RouterLink to="/submissions" class="btn-ghost -ml-2">← 我的提交</RouterLink>
      <h1 class="text-xl font-bold">提交 #{{ sub.id }}</h1>
      <span :class="['tag', STATUS_COLOR[sub.status as keyof typeof STATUS_COLOR]]">{{ STATUS_LABEL[sub.status as keyof typeof STATUS_LABEL] || sub.status }}</span>
    </div>

    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
      <div class="card p-3">
        <div class="text-zinc-500 text-xs">题目</div>
        <RouterLink :to="`/problem/${sub.problem_slug}`" class="link font-medium mt-0.5 block truncate">
          {{ sub.problem_title }}
        </RouterLink>
      </div>
      <div class="card p-3"><div class="text-zinc-500 text-xs">语言</div><div class="font-medium mt-0.5 uppercase">{{ langLabel }}</div></div>
      <div class="card p-3"><div class="text-zinc-500 text-xs">运行时间</div><div class="font-medium mt-0.5">{{ sub.run_time_ms ?? '-' }} ms</div></div>
      <div class="card p-3"><div class="text-zinc-500 text-xs">内存</div><div class="font-medium mt-0.5">{{ sub.memory_kb ? (sub.memory_kb / 1024).toFixed(1) + ' MB' : '-' }}</div></div>
    </div>

    <div v-if="cases.length" class="card overflow-hidden">
      <div class="px-4 py-2.5 border-b border-zinc-200 bg-zinc-50 text-sm font-semibold">测试用例</div>
      <div class="divide-y divide-zinc-100">
        <div v-for="(c, i) in cases" :key="i" class="px-4 py-3 text-sm">
          <div class="flex items-center gap-3 mb-2">
            <span class="font-mono text-xs text-zinc-500">#{{ i + 1 }}</span>
            <span :class="['tag', c.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700']">{{ c.passed ? '通过' : '不通过' }}</span>
            <span class="ml-auto text-xs text-zinc-500 font-mono">{{ c.timeMs }}ms · {{ (c.memoryKb/1024).toFixed(1) }}MB</span>
          </div>
          <div v-if="!c.passed" class="grid sm:grid-cols-2 gap-3 text-xs">
            <div>
              <div class="text-zinc-500 mb-1">期望输出</div>
              <pre class="!rounded-md !text-xs !p-2 !bg-zinc-900">{{ c.expected }}</pre>
            </div>
            <div>
              <div class="text-zinc-500 mb-1">你的输出</div>
              <pre class="!rounded-md !text-xs !p-2 !bg-rose-950">{{ c.actual }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card overflow-hidden">
      <div class="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 bg-zinc-50 text-sm">
        <span class="font-semibold">提交代码</span>
        <span class="text-xs text-zinc-500">{{ new Date(sub.created_at).toLocaleString() }}</span>
      </div>
      <pre class="!rounded-none !m-0 !bg-zinc-950 !text-xs">{{ sub.code }}</pre>
    </div>
  </div>
</template>
