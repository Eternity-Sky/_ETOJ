<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ref, onMounted, computed } from 'vue'
import { api, type Submission, STATUS_COLOR, STATUS_LABEL, LANGUAGES, TEST_CASE_STATUS } from '@/lib/api'
import { useToast } from '@/lib/toast'

const { success, error: toastError } = useToast()

const props = defineProps<{ id: string }>()
const sub = ref<Submission | null>(null)
const cases = ref<any[]>([])
const error = ref<string | null>(null)
const forbidden = ref(false)
const pollTimer = ref<any>(null)
const selectedCase = ref<number | null>(null)
const loading = ref(false)
const judging = ref(false)

async function retest() {
  try {
    const res = await api.post<any>('/api/submissions/retest', { submissionId: props.id })
    
    success('重测成功')
    // 重新加载当前提交记录
    load()
  } catch (e: any) {
    toastError('重测失败: ' + e.message)
  }
}

const langLabel = computed(() => LANGUAGES.find(l => l.value === sub.value?.language)?.label || sub.value?.language)

const parsedResult = computed(() => {
  if (!sub.value?.result_json) return null
  try { return JSON.parse(sub.value.result_json) } catch { return null }
})

function getTestCaseStatus(c: any): string {
  if (c.passed) return 'AC'
  if (c.reason === 'TLE') return 'TLE'
  if (c.reason === 'MLE') return 'MLE'
  if (c.reason === 'OLE') return 'OLE'
  if (c.reason === 'RE') return 'RE'
  if (c.reason === 'CE') return 'CE'
  if (c.status) return c.status.toUpperCase()
  return 'WA'
}

function getTestCaseInfo(c: any, i: number) {
  const status = getTestCaseStatus(c)
  const config = TEST_CASE_STATUS[status] || TEST_CASE_STATUS.UKE
  return {
    index: i + 1,
    status,
    config,
    passed: c.passed,
    timeMs: c.timeMs,
    memoryKb: c.memoryKb || 0,
    expected: c.expected,
    actual: c.actual
  }
}

function getCompileError() {
  if (!sub.value?.result_json) return '无编译错误信息'
  try {
    const result = JSON.parse(sub.value.result_json)
    if (result.error) {
      return result.error
    }
    if (result.details && result.details.compilerOutput) {
      return result.details.compilerOutput
    }
    if (result.details && result.details.error) {
      return result.details.error
    }
    if (result.details && result.details.msg) {
      return result.details.msg
    }
    return JSON.stringify(result, null, 2)
  } catch {
    return sub.value.result_json
  }
}

function getRuntimeError() {
  if (!sub.value?.result_json) return '无运行错误信息'
  try {
    const result = JSON.parse(sub.value.result_json)
    if (result.details && result.details.compilerOutput) {
      return result.details.compilerOutput
    }
    if (result.details && result.details.error) {
      return result.details.error
    }
    if (result.details && result.details.message) {
      return result.details.message
    }
    if (result.details && result.details.msg) {
      return result.details.msg
    }
    if (result.details && result.details.details) {
      return JSON.stringify(result.details.details, null, 2)
    }
    return JSON.stringify(result.details, null, 2)
  } catch {
    return sub.value.result_json
  }
}

async function load() {
  try {
    loading.value = true
    error.value = null
    forbidden.value = false
    
    const submission = await api.get(`/api/submissions/${props.id}`)
    
    sub.value = submission
    
    // 解析结果JSON并提取测试用例
    const result = parsedResult.value
    if (result?.details?.details && Array.isArray(result.details.details)) {
      // 优先使用 details.details
      cases.value = result.details.details
    } else if (result?.details && Array.isArray(result.details)) {
      // 如果 details 直接是数组
      cases.value = result.details
    } else {
      cases.value = []
    }
    
    // 如果状态是pending或judging，开始轮询
    if (submission.status === 'pending' || submission.status === 'judging') {
      judging.value = true
      startPoll()
    } else {
      judging.value = false
      clearInterval(pollTimer.value)
    }
  } catch (e: any) {
    if (e.message === 'Forbidden' || e.message.includes('403')) {
      forbidden.value = true
      error.value = '无权查看此提交记录'
    } else {
      error.value = e.message || '加载失败'
    }
  } finally {
    loading.value = false
  }
}

function startPoll() {
  let n = 0
  clearInterval(pollTimer.value)
  pollTimer.value = setInterval(async () => {
    try {
      n++
      
      const submission = await api.get(`/api/submissions/${props.id}`)
      
      sub.value = submission
      
      // 使用与load相同的逻辑提取测试用例
      const result = parsedResult.value
      if (result?.details?.details && Array.isArray(result.details.details)) {
        cases.value = result.details.details
      } else if (result?.details && Array.isArray(result.details)) {
        cases.value = result.details
      } else {
        cases.value = []
      }
      
      if (submission.status !== 'pending' && submission.status !== 'judging') {
        judging.value = false
        clearInterval(pollTimer.value)
      }
    } catch (e: any) {
      // 继续轮询
    }
    if (n > 60) {
      judging.value = false
      clearInterval(pollTimer.value)
    }
  }, 2000)
}

onMounted(() => {
  load()
  // 组件卸载时清除轮询
  return () => clearInterval(pollTimer.value)
})
</script>

<template>
  <div v-if="loading" class="max-w-4xl mx-auto p-6 flex items-center justify-center">
    <div class="flex flex-col items-center gap-4">
      <div class="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
      <div class="text-zinc-500">加载中...</div>
    </div>
  </div>

  <div v-else-if="error" class="max-w-4xl mx-auto p-6">
    <div class="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
      {{ error }}
    </div>
    <RouterLink to="/submissions" class="btn-ghost mt-4 inline-block">← 返回提交记录</RouterLink>
  </div>
  
  <div v-else-if="sub" class="space-y-5">
    <div class="flex flex-wrap items-center gap-3">
      <RouterLink to="/submissions" class="btn-ghost -ml-2">← 提交记录</RouterLink>
      <h1 class="text-xl font-bold">提交 #{{ sub.id }}</h1>
      <span :class="['tag', STATUS_COLOR[sub.status as keyof typeof STATUS_COLOR]]">{{ STATUS_LABEL[sub.status as keyof typeof STATUS_LABEL] || sub.status }}</span>
      <button @click="retest" class="btn-outline text-xs">重测</button>
      
      <!-- 评测中指示器 -->
      <div v-if="judging" class="flex items-center gap-2 text-sm text-zinc-500">
        <div class="w-4 h-4 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
        <span>评测中...</span>
      </div>
    </div>

    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
      <div class="card p-3">
        <div class="text-zinc-500 text-xs">题目</div>
        <RouterLink :to="`/problem/${sub.problem_id}`" class="link font-medium mt-0.5 block truncate">
          {{ sub.problem_title }}
        </RouterLink>
      </div>
      <div class="card p-3"><div class="text-zinc-500 text-xs">语言</div><div class="font-medium mt-0.5 uppercase">{{ langLabel }}</div></div>
      <div class="card p-3"><div class="text-zinc-500 text-xs">运行时间</div><div class="font-medium mt-0.5">{{ sub.run_time_ms ?? '-' }} ms</div></div>
      <div class="card p-3"><div class="text-zinc-500 text-xs">内存</div><div class="font-medium mt-0.5">{{ sub.memory_kb ? (sub.memory_kb / 1024).toFixed(1) + ' MB' : '-' }}</div></div>
    </div>

    <div v-if="sub.status === 'compile_error'" class="card overflow-hidden">
      <div class="px-4 py-2.5 border-b border-zinc-200 bg-red-50 text-sm font-semibold text-red-700">编译错误</div>
      <div class="p-4">
        <pre class="!rounded-md !text-xs !p-4 !bg-red-950 !text-red-100">{{ getCompileError() }}</pre>
      </div>
    </div>

    <div v-if="sub.status === 'runtime_error'" class="card overflow-hidden">
      <div class="px-4 py-2.5 border-b border-zinc-200 bg-purple-50 text-sm font-semibold text-purple-700">运行错误</div>
      <div class="p-4">
        <pre v-if="getRuntimeError() !== '无运行错误信息'" class="!rounded-md !text-xs !p-4 !bg-purple-950 !text-purple-100">{{ getRuntimeError() }}</pre>
        <div v-else class="text-zinc-500 text-sm">程序运行时发生错误，可能是内存访问违规、除零错误或异常退出。</div>
      </div>
    </div>

    <div v-if="sub.status === 'time_limit_exceeded'" class="card overflow-hidden">
      <div class="px-4 py-2.5 border-b border-zinc-200 bg-blue-50 text-sm font-semibold text-blue-700">超时错误</div>
      <div class="p-4">
        <pre v-if="getRuntimeError() !== '无运行错误信息'" class="!rounded-md !text-xs !p-4 !bg-blue-950 !text-blue-100">{{ getRuntimeError() }}</pre>
        <div v-else class="text-zinc-500 text-sm">程序运行时间超过限制，请优化算法或检查是否有死循环。</div>
      </div>
    </div>

    <div v-if="sub.status === 'memory_limit_exceeded'" class="card overflow-hidden">
      <div class="px-4 py-2.5 border-b border-zinc-200 bg-orange-50 text-sm font-semibold text-orange-700">内存超限</div>
      <div class="p-4">
        <pre v-if="getRuntimeError() !== '无运行错误信息'" class="!rounded-md !text-xs !p-4 !bg-orange-950 !text-orange-100">{{ getRuntimeError() }}</pre>
        <div v-else class="text-zinc-500 text-sm">程序内存使用超过限制，请优化内存使用或检查是否有内存泄漏。</div>
      </div>
    </div>

    <div v-if="cases.length" class="card overflow-hidden">
      <div class="px-4 py-2.5 border-b border-zinc-200 bg-zinc-50 text-sm font-semibold">测试点信息</div>
      <div class="p-4">
        <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
          <div 
            v-for="(c, i) in cases" 
            :key="i"
            @click="selectedCase = selectedCase === i ? null : i"
            :class="[
              'relative p-2 rounded-lg cursor-pointer transition-all hover:scale-105',
              'border-2',
              selectedCase === i ? 'border-zinc-800 ring-2 ring-zinc-400' : 'border-transparent',
              getTestCaseInfo(c, i).config.color
            ]"
          >
            <div class="text-center">
              <div class="text-xs font-bold">#{{ i + 1 }}</div>
              <div class="text-sm font-bold mt-1">{{ getTestCaseInfo(c, i).config.label }}</div>
              <div v-if="c.passed && c.timeMs" class="text-xs mt-1 opacity-90">
                {{ c.timeMs }}ms/{{ c.memoryKb ? (c.memoryKb/1024).toFixed(0) + 'KB' : '0KB' }}
              </div>
              <div v-else-if="c.passed" class="text-xs mt-1 opacity-90">
                {{ c.timeMs }}ms/0KB
              </div>
            </div>
          </div>
        </div>
        
        <!-- 测试点详情 -->
        <div v-if="selectedCase !== null" class="mt-4 p-4 bg-zinc-50 rounded-lg border border-zinc-200">
          <div class="font-semibold mb-2">测试点 #{{ selectedCase + 1 }}</div>
          <div v-if="!cases[selectedCase].passed" class="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div class="text-zinc-500 mb-1">期望输出</div>
              <pre class="!rounded-md !text-xs !p-2 !bg-zinc-900">{{ cases[selectedCase].expected }}</pre>
            </div>
            <div>
              <div class="text-zinc-500 mb-1">你的输出</div>
              <pre class="!rounded-md !text-xs !p-2 !bg-rose-950">{{ cases[selectedCase].actual }}</pre>
            </div>
          </div>
          <div v-else class="text-sm text-emerald-600">
            ✅ 通过 - 耗时 {{ cases[selectedCase].timeMs }}ms，内存 {{ (cases[selectedCase].memoryKb/1024).toFixed(1) }}MB
          </div>
        </div>
      </div>
    </div>

    <!-- 没有测试点详情时显示提示 -->
    <div v-else-if="sub.status !== 'pending' && sub.status !== 'judging'" class="card overflow-hidden">
      <div class="px-4 py-2.5 border-b border-zinc-200 bg-zinc-50 text-sm font-semibold">测试点信息</div>
      <div class="p-4">
        <div class="text-zinc-500 text-sm">
          {{ sub.status === 'compile_error' ? '编译错误，无测试点信息' : 
             sub.status === 'runtime_error' ? '运行错误，无测试点信息' :
             sub.status === 'time_limit_exceeded' ? '超时，无测试点信息' :
             sub.status === 'memory_limit_exceeded' ? '内存超限，无测试点信息' :
             '无测试点信息' }}
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
