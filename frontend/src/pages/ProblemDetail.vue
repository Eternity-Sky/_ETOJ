<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ref, onMounted, computed, watch } from 'vue'
import { api, type Problem, type SubmissionStatus, DIFFICULTY_COLOR, DIFFICULTY_LABEL, LANGUAGES, STATUS_COLOR, STATUS_LABEL } from '@/lib/api'
import { useToast } from '@/lib/toast'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import CodeEditor from '@/components/CodeEditor.vue'
import Captcha from '@/components/Captcha.vue'
import SolutionEditor from '@/components/SolutionEditor.vue'
import SolutionComments from '@/components/SolutionComments.vue'
import UserLink from '@/components/UserLink.vue'

const { success, error: toastError, info } = useToast()

const props = defineProps<{ id: string }>()
const problem = ref<Problem | null>(null)
const loading = ref(false)

const code = ref('')
const submitting = ref(false)
const language = ref('cpp')
const activeTab = ref('description') // 'description', 'submit', 'solutions'
const captchaInput = ref('')
const captchaId = ref('')
const captchaCode = ref('')

const solutions = ref<any[]>([])
const loadingSolutions = ref(false)
const showSolutionEditor = ref(false)
const editingSolution = ref<any>(null)
const currentUserId = ref<number | null>(null)

const templates: Record<string, string> = {
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n    cout << a + b << endl;\n    return 0;\n}\n`,

  python3: `a, b = map(int, input().split())\nprint(a + b)\n`,

  pypy3: `a, b = map(int, input().split())\nprint(a + b)\n`,
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

watch(activeTab, (v) => {
  if (v === 'solutions') {
    loadSolutions()
  }
})

async function load() {
  loading.value = true
  try {
    problem.value = await api.get(`/api/problems/${props.id}`)
    if (!code.value) code.value = templates[language.value] || ''
    await getCaptcha()
    
    // Get current user ID
    const userStr = localStorage.getItem('etoj_user')
    if (userStr) {
      const user = JSON.parse(userStr)
      currentUserId.value = user.id
    }
  } catch (e: any) {
    toastError('Load failed: ' + e.message)
  } finally {
    loading.value = false
  }
}

async function getCaptcha() {
  try {
    const response = await api.get('/api/captcha')
    captchaId.value = response.captchaId
    captchaCode.value = response.captchaCode
    captchaInput.value = '' // 刷新时清空输入
    console.log('验证码已刷新，ID:', response.captchaId)
  } catch (e: any) {
    console.error('Failed to get captcha:', e)
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
    
    success('Submitted successfully')
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

async function loadSolutions() {
  loadingSolutions.value = true
  try {
    const data = await api.get(`/api/problems/${props.id}/solutions`)
    solutions.value = data.solutions || []
  } catch (e: any) {
    toastError('Failed to load solutions: ' + e.message)
  } finally {
    loadingSolutions.value = false
  }
}

function openSolutionEditor(solution?: any) {
  editingSolution.value = solution || null
  showSolutionEditor.value = true
}

async function saveSolution(data: { title: string; content: string }) {
  try {
    if (editingSolution.value) {
      await api.put(`/api/solutions/${editingSolution.value.id}`, data)
      success('Solution updated successfully')
    } else {
      await api.post('/api/solutions', {
        problemId: props.id,
        ...data
      })
      success('Solution created successfully')
    }
    showSolutionEditor.value = false
    editingSolution.value = null
    await loadSolutions()
  } catch (e: any) {
    toastError('Failed to save solution: ' + e.message)
  }
}

async function deleteSolution(id: number) {
  if (!confirm('确定要删除这个题解吗？')) return
  
  try {
    await api.del(`/api/solutions/${id}`)
    success('Solution deleted successfully')
    await loadSolutions()
  } catch (e: any) {
    toastError('Failed to delete solution: ' + e.message)
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
          <button 
            @click="activeTab = 'solutions'"
            :class="['px-4 py-2 text-sm border-b-2 transition-colors', 
              activeTab === 'solutions' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-400 hover:text-zinc-100']"
          >
            题解 ({{ solutions.length }})
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
            </div>
          </div>
          <MarkdownRenderer :content="problem.description" />
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

      <!-- 题解标签页 -->
      <div v-if="activeTab === 'solutions'" class="space-y-4">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold">题解</h2>
          <button 
            @click="openSolutionEditor()"
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
          >
            写题解
          </button>
        </div>
        
        <div v-if="loadingSolutions" class="flex items-center justify-center py-12">
          <div class="w-8 h-8 border-4 border-zinc-700 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
        
        <div v-else-if="solutions.length === 0" class="text-center py-12 text-zinc-500">
          暂无题解，快来写第一个题解吧！
        </div>
        
        <div v-else class="space-y-4">
          <div 
            v-for="solution in solutions" 
            :key="solution.id"
            class="bg-zinc-800 rounded-lg p-6"
          >
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-lg font-semibold">{{ solution.title }}</h3>
                <p class="text-sm text-zinc-400 mt-1 flex items-center gap-2">
                  By
                  <UserLink
                    v-if="solution.user_id"
                    :user-id="solution.user_id"
                    :username="solution.username"
                    :avatar-url="solution.avatar_url"
                    size="sm"
                  />
                  <span v-else>{{ solution.username }}</span>
                  · {{ new Date(solution.created_at).toLocaleDateString() }}
                </p>
              </div>
              <div class="flex gap-2">
                <button 
                  v-if="solution.user_id === currentUserId"
                  @click="openSolutionEditor(solution)"
                  class="text-sm text-blue-400 hover:text-blue-300"
                >
                  编辑
                </button>
                <button 
                  v-if="solution.user_id === currentUserId"
                  @click="deleteSolution(solution.id)"
                  class="text-sm text-red-400 hover:text-red-300"
                >
                  删除
                </button>
              </div>
            </div>
            <MarkdownRenderer :content="solution.content" />
            <SolutionComments 
              :solution-id="solution.id" 
              :current-user-id="currentUserId || undefined"
            />
          </div>
        </div>
      </div>
    </div>
    
    <!-- 题解编辑器对话框 -->
    <div v-if="showSolutionEditor" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-semibold mb-4">
          {{ editingSolution ? '编辑题解' : '写题解' }}
        </h3>
        <SolutionEditor
          :problem-id="Number(props.id)"
          :existing-solution="editingSolution"
          @save="saveSolution"
          @cancel="showSolutionEditor = false; editingSolution = null"
        />
      </div>
    </div>
  </div>
</template>
