<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ref, onMounted, computed, watch } from 'vue'
import { api, type Problem, type SubmissionStatus, DIFFICULTY_COLOR, DIFFICULTY_LABEL, LANGUAGES, STATUS_COLOR, STATUS_LABEL } from '@/lib/api'
import { useToast } from '@/lib/toast'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import CodeEditor from '@/components/CodeEditor.vue'
import Captcha from '@/components/Captcha.vue'

const { success, error: toastError, info } = useToast()

const props = defineProps<{ id: string }>()
const problem = ref<Problem | null>(null)
const loading = ref(false)

const code = ref('')
const submitting = ref(false)
const language = ref('cpp')
const activeTab = ref('description') // 'description' or 'submit'
const captchaInput = ref('')
const captchaId = ref('')
const captchaCode = ref('')

const templates: Record<string, string> = {
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n    cout << a + b << endl;\n    return 0;\n}\n`,
}

const acceptRate = computed(() => {
  if (!problem.value) return 0
  if (!problem.value.submission_count || problem.value.submission_count === 0) return 0
  const rate = Math.round(problem.value.accepted_count * 100 / problem.value.submission_count)
  return Math.min(rate, 100) // 确保不超过100%
})

watch(language, (v) => {
  if (!code.value) code.value = templates[v] || ''
})

async function load() {
  loading.value = true
  try {
    problem.value = await api.get(`/api/problems/${props.id}`)
    if (!code.value) code.value = templates[language.value] || ''
    await getCaptcha()
  } catch (e: any) {
    toastError('加载失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

async function getCaptcha() {
  try {
    const response = await api.get('/api/captcha')
    captchaId.value = response.captchaId
    captchaCode.value = response.captchaCode
  } catch (e: any) {
    console.error('获取验证码失败:', e)
  }
}

async function submit() {
  if (!code.value.trim()) return info('请输入代码')
  if (!captchaInput.value.trim()) return info('请输入验证码')
  
  submitting.value = true
  
  try {
    const res = await api.post<any>('/api/submissions', {
      problemId: props.id,
      language: language.value,
      code: code.value,
      captchaId: captchaId.value,
      captchaCode: captchaInput.value
    })
    
    success('提交成功')
    location.href = `/submission/${res.id}`
    
  } catch (e: any) {
    toastError(e.message)
    // 刷新验证码
    await getCaptcha()
    captchaInput.value = ''
  } finally { submitting.value = false }
}

function copyMarkdown() {
  if (problem.value) {
    navigator.clipboard.writeText(problem.value.description)
    info('已复制Markdown')
  }
}

onMounted(load)
</script>

<template>
  <div v-if="loading" class="min-h-screen bg-zinc-900 flex items-center justify-center">
    <div class="flex flex-col items-center gap-4">
      <div class="w-8 h-8 border-4 border-zinc-700 border-t-blue-500 rounded-full animate-spin"></div>
      <div class="text-zinc-400">加载中...</div>
    </div>
  </div>

  <div v-else-if="problem" class="min-h-screen bg-zinc-900 text-zinc-100">
    <!-- 头部导航 -->
    <div class="bg-zinc-800 border-b border-zinc-700">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        <RouterLink to="/problems" class="text-zinc-400 hover:text-zinc-100">← 返回</RouterLink>
        <div class="flex items-center gap-3">
          <span class="text-zinc-400 font-mono">{{ problem.id }}</span>
          <h1 class="text-lg font-bold">{{ problem.title }}</h1>
        </div>
      </div>
    </div>

    <!-- 选项卡 -->
    <div class="bg-zinc-800 border-b border-zinc-700">
      <div class="max-w-6xl mx-auto px-4">
        <div class="flex gap-1">
          <button 
            @click="activeTab = 'description'"
            :class="['px-4 py-2 text-sm border-b-2 transition-colors', 
              activeTab === 'description' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-400 hover:text-zinc-100']"
          >
            题目描述
          </button>
          <button 
            @click="activeTab = 'submit'"
            :class="['px-4 py-2 text-sm border-b-2 transition-colors', 
              activeTab === 'submit' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-400 hover:text-zinc-100']"
          >
            提交答案
          </button>
        </div>
      </div>
    </div>

    <!-- 主要内容 -->
    <div class="max-w-6xl mx-auto px-4 py-6">
      <!-- 题目描述标签页 -->
      <div v-if="activeTab === 'description'" class="space-y-6">
        <!-- 统计信息 -->
        <div class="flex gap-4 text-sm text-zinc-400">
          <span>时限: {{ problem.time_limit_ms }}ms</span>
          <span>内存: {{ problem.memory_limit_mb }}MB</span>
          <span>提交: {{ problem.submission_count }}</span>
          <span>通过率: {{ acceptRate }}%</span>
        </div>

        <!-- 题目描述 -->
        <div class="bg-zinc-800 rounded-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold">题目描述</h2>
            <div class="flex items-center gap-2 text-xs text-zinc-400">
              <button @click="copyMarkdown" class="hover:text-zinc-100">复制 Markdown</button>
              <span>中文</span>
              <span>展开</span>
              <span>进入 IDE 模式</span>
            </div>
          </div>
          <MarkdownRenderer :content="problem.description" />
        </div>

        <!-- 输入格式 -->
        <div v-if="problem.input_format" class="bg-zinc-800 rounded-lg p-6">
          <h2 class="text-lg font-semibold mb-4">输入格式</h2>
          <MarkdownRenderer :content="problem.input_format" />
        </div>

        <!-- 输出格式 -->
        <div v-if="problem.output_format" class="bg-zinc-800 rounded-lg p-6">
          <h2 class="text-lg font-semibold mb-4">输出格式</h2>
          <MarkdownRenderer :content="problem.output_format" />
        </div>

        <!-- 样例 -->
        <div class="grid sm:grid-cols-2 gap-4">
          <div class="bg-zinc-800 rounded-lg p-4">
            <h3 class="text-sm font-semibold text-zinc-400 mb-2">样例输入</h3>
            <pre class="text-zinc-100 text-sm font-mono whitespace-pre-wrap">{{ problem.sample_input || '' }}</pre>
          </div>
          <div class="bg-zinc-800 rounded-lg p-4">
            <h3 class="text-sm font-semibold text-zinc-400 mb-2">样例输出</h3>
            <pre class="text-zinc-100 text-sm font-mono whitespace-pre-wrap">{{ problem.sample_output || '' }}</pre>
          </div>
        </div>
      </div>

      <!-- 提交答案标签页 -->
      <div v-if="activeTab === 'submit'" class="space-y-4">
        <div class="bg-zinc-800 rounded-lg overflow-hidden">
          <!-- 工具栏 -->
          <div class="flex items-center justify-between px-4 py-2 border-b border-zinc-700 bg-zinc-750">
            <div class="flex items-center gap-2">
              <label class="text-sm text-zinc-400">语言:</label>
              <select v-model="language" class="bg-zinc-700 text-zinc-100 text-sm rounded px-2 py-1 border border-zinc-600 focus:outline-none focus:border-blue-500">
                <option v-for="lang in LANGUAGES" :key="lang.value" :value="lang.value">{{ lang.label }}</option>
              </select>
              <button @click="code = templates[language] || ''" class="text-xs text-zinc-400 hover:text-zinc-100">模板</button>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-zinc-500">{{ code.length }} chars</span>
              <button @click="code = ''" class="text-xs text-zinc-400 hover:text-zinc-100">清空</button>
            </div>
          </div>
          
          <!-- 代码编辑器 -->
          <CodeEditor 
            v-model="code" 
            :language="language"
            height="500px"
          />
          
          <!-- 验证码 -->
          <div class="px-4 py-3 border-t border-zinc-700 bg-zinc-750">
            <Captcha 
              v-model="captchaInput" 
              :captcha-code="captchaCode"
              @refresh="getCaptcha"
            />
          </div>
          
          <!-- 提交按钮 -->
          <div class="flex justify-end p-4 border-t border-zinc-700 bg-zinc-750">
            <button @click="submit" :disabled="submitting" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <svg v-if="submitting" class="animate-spin h-4 w-4 mr-2 inline" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
              {{ submitting ? '提交中...' : '提交答案' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
