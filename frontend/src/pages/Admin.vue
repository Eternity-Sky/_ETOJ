<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { api } from '@/lib/api'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import { useToast } from '@/lib/toast'

const { success, error: toastError } = useToast()

const currentUser = ref<any>(null)
const isSuperAdmin = ref(false) // 是否是超级管理员（用户名为admin）
const stats = ref({ submissions: 0, users: 0, problems: 0 })
const loading = ref(false)
const loadingProblems = ref(false)
const activeTab = ref<'stats' | 'problems' | 'edit'>('stats')
const problems = ref<any[]>([])
const editingProblem = ref<any>(null)
const problemForm = ref({
  id: '',
  title: '',
  description: '',
  input_format: '',
  output_format: '',
  time_limit_ms: 1000,
  memory_limit_mb: 256,
  difficulty: 'easy',
  test_cases_json: '[{"input":"","output":""}]'
})

const markdownContent = ref('')
const testCases = ref<{input: string, output: string, input_file?: File, output_file?: File}[]>([{input: '', output: ''}])

const users = ref<any[]>([])
const loadingUsers = ref(false)
const selectedUser = ref<any>(null)
const notificationForm = ref({
  type: 'info',
  title: '',
  message: ''
})
const showNotificationDialog = ref(false)

async function loadMe() {
  try {
    const me = await api.get('/api/auth/me')
    currentUser.value = me
    isSuperAdmin.value = me.username === 'admin' // 只有用户名为admin的人是超级管理员
    // 如果用户是管理员，自动加载数据
    if (me.role === 'admin') {
      loadStats()
      loadProblems()
    }
  } catch {
    currentUser.value = null
  }
}

async function loadStats() {
  try {
    loading.value = true
    const data = await api.get('/api/admin/stats')
    stats.value = data
  } catch (e: any) {
    toastError(e.message || 'Failed to load statistics')
  } finally {
    loading.value = false
  }
}

async function loadUsers() {
  try {
    loadingUsers.value = true
    const data = await api.get('/api/admin/users')
    users.value = data.users || []
  } catch (e: any) {
    toastError(e.message || 'Failed to load users')
  } finally {
    loadingUsers.value = false
  }
}

async function updateUserRole(userId: number, role: string) {
  try {
    await api.put(`/api/admin/users/${userId}`, { role })
    success('User role updated successfully')
    await loadUsers()
  } catch (e: any) {
    toastError(e.message || 'Update failed')
  }
}

async function deleteUser(userId: number) {
  if (!confirm('确定要删除此用户吗？')) return
  try {
    await api.del(`/api/admin/users/${userId}`)
    success('User deleted successfully')
    await loadUsers()
  } catch (e: any) {
    toastError(e.message || 'Delete failed')
  }
}

function openNotificationDialog(user: any) {
  selectedUser.value = user
  notificationForm.value = {
    type: 'info',
    title: '',
    message: ''
  }
  showNotificationDialog.value = true
}

async function sendNotification() {
  if (!selectedUser.value || !notificationForm.value.title || !notificationForm.value.message) {
    toastError('Please fill in all required fields')
    return
  }
  
  try {
    await api.sendNotification({
      userId: selectedUser.value.id,
      type: notificationForm.value.type,
      title: notificationForm.value.title,
      message: notificationForm.value.message
    })
    success('Notification sent successfully')
    showNotificationDialog.value = false
    selectedUser.value = null
  } catch (e: any) {
    toastError(e.message || 'Failed to send notification')
  }
}

async function loadProblems() {
  try {
    loadingProblems.value = true
    const data = await api.get('/api/problems')
    console.log('题目列表API响应:', data)
    problems.value = data.items || []
    console.log('赋值后的题目数组:', problems.value)
  } catch (e: any) {
    toastError(e.message || 'Failed to load problems')
  } finally {
    loadingProblems.value = false
  }
}

async function clearSubmissions() {
  if (!confirm('确定要清空所有提交记录吗？此操作不可撤销。')) return
  
  try {
    loading.value = true
    const result = await api.post('/api/admin/clear-submissions')
    success(result.message || 'Cleared successfully')
    await loadStats()
  } catch (e: any) {
    toastError(e.message || 'Clear failed')
  } finally {
    loading.value = false
  }
}

async function renumberProblems() {
  if (!confirm('确定要自动重新编号所有题目吗？此操作会更新所有题号和相关提交记录，不可撤销。')) return
  
  try {
    loading.value = true
    const result = await api.post('/api/admin/renumber-problems')
    success(result.message || 'Renumbering successful')
    // 强制刷新：先清空本地数据，再重新加载
    problems.value = []
    stats.value = null
    await loadProblems()
    await loadStats()
  } catch (e: any) {
    toastError(e.message || 'Renumbering failed')
  } finally {
    loading.value = false
  }
}

function editProblem(problem: any) {
  console.log('编辑题目数据:', problem)
  editingProblem.value = problem
  problemForm.value = {
    id: problem.id ? problem.id.toString() : '',
    title: problem.title || '',
    description: problem.description || '',
    input_format: problem.input_format || '',
    output_format: problem.output_format || '',
    sample_input: problem.sample_input || '',
    sample_output: problem.sample_output || '',
    time_limit_ms: problem.time_limit_ms || 1000,
    memory_limit_mb: problem.memory_limit_mb || 256,
    difficulty: problem.difficulty || 'easy',
    test_cases_json: problem.test_cases_json || '[{"input":"","output":""}]'
  }
  
  // 解析测试点
  try {
    const parsed = JSON.parse(problemForm.value.test_cases_json)
    if (Array.isArray(parsed) && parsed.length > 0) {
      testCases.value = parsed
    } else {
      testCases.value = [{input: '', output: ''}]
    }
  } catch {
    testCases.value = [{input: '', output: ''}]
  }
  
  // 如果有旧的分离字段，合并到markdown中
  let md = problem.description || ''
  if (problem.input_format && !md.includes('## 输入格式')) {
    md += `\n\n## 输入格式\n\n${problem.input_format}`
  }
  if (problem.output_format && !md.includes('## 输出格式')) {
    md += `\n\n## 输出格式\n\n${problem.output_format}`
  }
  if (problem.sample_input && !md.includes('## 样例输入')) {
    md += `\n\n## 样例输入\n\n\`\`\`\n${problem.sample_input}\n\`\`\``
  }
  if (problem.sample_output && !md.includes('## 样例输出')) {
    md += `\n\n## 样例输出\n\n\`\`\`\n${problem.sample_output}\n\`\`\``
  }
  
  markdownContent.value = md.trim()
  console.log('markdown内容:', markdownContent.value)
  activeTab.value = 'edit'
}

function createNewProblem() {
  editingProblem.value = null
  problemForm.value = {
    id: '',
    title: '',
    description: '',
    input_format: '',
    output_format: '',
    time_limit_ms: 1000,
    memory_limit_mb: 256,
    difficulty: 'easy',
    test_cases_json: '[{"input":"","output":""}]'
  }
  testCases.value = [{input: '', output: ''}]
  markdownContent.value = '' // 新建时不预填模板
  activeTab.value = 'edit'
}



function loadTemplate(): void {
  markdownContent.value = `## 题目描述

## 输入格式

## 输出格式

## 样例输入

\`\`\`
\`\`\`

## 样例输出

\`\`\`
\`\`\`
`
  
  // 同时重置测试点
  testCases.value = [{input: '', output: ''}]
}

async function saveProblem() {
  try {
    loading.value = true
    
    // 更新测试点JSON
    updateTestCasesJson()
    
    // 直接使用markdown内容作为description
    const saveData = {
      ...problemForm.value,
      id: parseInt(problemForm.value.id), // 确保id是数字
      description: markdownContent.value || '',
      input_format: problemForm.value.input_format || '',
      output_format: problemForm.value.output_format || '',
      sample_input: problemForm.value.sample_input || '',
      sample_output: problemForm.value.sample_output || '',
      test_cases_json: problemForm.value.test_cases_json
    }
    
    if (editingProblem.value) {
      await api.put(`/api/problems/${editingProblem.value.id}`, saveData)
      success('Problem updated successfully')
    } else {
      await api.post('/api/problems', saveData)
      success('Problem created successfully')
    }
    
    await loadProblems()
    activeTab.value = 'problems'
  } catch (e: any) {
    toastError(e.message || 'Save failed')
  } finally {
    loading.value = false
  }
}

async function deleteProblem(id: number) {
  if (!confirm('确定要删除这个题目吗？')) return
  
  try {
    loading.value = true
    await api.del(`/api/problems/${id}`)
    success('Problem deleted successfully')
    // 从本地数组中移除题目
    problems.value = problems.value.filter(p => p.id !== id)
    // 刷新以确保数据同步
    await loadProblems()
  } catch (e: any) {
    toastError(e.message || 'Delete failed')
  } finally {
    loading.value = false
  }
}

function addTestCase() {
  testCases.value.push({input: '', output: ''})
}

function removeTestCase(index: number) {
  if (testCases.value.length > 1) {
    testCases.value.splice(index, 1)
  }
}

function handleTestCaseFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      // 解析文件内容：奇数行是输入，偶数行是输出
      const lines = content.split('\n').filter(line => line.trim())
      if (lines.length > 0) {
        testCases.value = []
        for (let i = 0; i < lines.length; i += 2) {
          const input = lines[i] || ''
          const output = lines[i + 1] || ''
          testCases.value.push({ input, output })
        }
      }
    }
    reader.readAsText(file)
  }
}

function updateTestCasesJson() {
  problemForm.value.test_cases_json = JSON.stringify(testCases.value.filter(tc => tc.input || tc.output))
}

// 监听测试点变化，自动更新JSON
watch(testCases, () => {
  updateTestCasesJson()
}, { deep: true })



onMounted(() => {
  loadMe()
})
</script>

<template>
  <div class="max-w-6xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6 text-zinc-100">后台管理</h1>
    
    <div v-if="!currentUser || currentUser.role !== 'admin'" class="bg-red-900/30 border border-red-800 text-red-400 p-4 rounded-lg">
      需要管理员权限才能访问此页面
    </div>
    
    <div v-else class="space-y-6">
      <!-- Tab导航 -->
      <div class="flex gap-2 border-b border-zinc-700 -mx-6 px-6 mb-4">
        <button 
          @click="activeTab = 'stats'"
          :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px', activeTab === 'stats' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-400 hover:text-zinc-100']"
        >
          统计信息
        </button>
        <button 
          @click="activeTab = 'problems'; loadProblems()"
          :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px', activeTab === 'problems' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-400 hover:text-zinc-100']"
        >
          题目管理
        </button>
        <button 
          @click="activeTab = 'users'; loadUsers()"
          :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px', activeTab === 'users' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-400 hover:text-zinc-100']"
        >
          用户管理
        </button>
        <button 
          v-if="activeTab === 'edit'"
          @click="activeTab = 'problems'"
          :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px', 'border-transparent text-zinc-400 hover:text-zinc-100']"
        >
          编辑题目
        </button>
      </div>
      
      <!-- 统计信息 -->
      <div v-if="activeTab === 'stats'" class="space-y-6">
        <div class="grid grid-cols-3 gap-4">
          <div class="bg-zinc-800 border border-zinc-700 p-6 rounded-lg">
            <div class="text-zinc-400 text-sm">提交记录</div>
            <div class="text-3xl font-bold mt-2 text-zinc-100">{{ stats.submissions }}</div>
          </div>
          <div class="bg-zinc-800 border border-zinc-700 p-6 rounded-lg">
            <div class="text-zinc-400 text-sm">用户数量</div>
            <div class="text-3xl font-bold mt-2 text-zinc-100">{{ stats.users }}</div>
          </div>
          <div class="bg-zinc-800 border border-zinc-700 p-6 rounded-lg">
            <div class="text-zinc-400 text-sm">题目数量</div>
            <div class="text-3xl font-bold mt-2 text-zinc-100">{{ stats.problems }}</div>
          </div>
        </div>
        
        <div class="bg-zinc-800 border border-zinc-700 p-6 rounded-lg">
          <h2 class="text-lg font-semibold mb-4 text-zinc-100">管理操作</h2>
          <div class="space-y-4">
            <button @click="loadStats" :disabled="loading" class="border border-zinc-600 hover:border-zinc-500 text-zinc-300 px-4 py-2 rounded-md text-sm transition-colors">刷新统计</button>
            <button @click="clearSubmissions" :disabled="loading" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm transition-colors">清空提交记录</button>
          <button @click="renumberProblems" :disabled="loading" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm transition-colors">自动重新编号</button>
          </div>
        </div>
      </div>
      
      <!-- 题目管理 -->
      <div v-if="activeTab === 'problems'" class="space-y-4">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold text-zinc-100">题目列表</h2>
          <button @click="createNewProblem" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors">创建新题目</button>
        </div>
        
        <div v-if="loadingProblems" class="flex items-center justify-center py-8">
          <div class="w-8 h-8 border-4 border-zinc-700 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
        
        <div v-else class="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-zinc-750 border-b border-zinc-700 text-zinc-400">
              <tr>
                <th class="text-left px-4 py-3 font-medium">题号</th>
                <th class="text-left px-4 py-3 font-medium">标题</th>
                <th class="text-left px-4 py-3 font-medium">难度</th>
                <th class="text-left px-4 py-3 font-medium">通过率</th>
                <th class="text-right px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in problems" :key="p.id || Math.random()" class="border-b border-zinc-700 hover:bg-zinc-750/50">
                <td class="px-4 py-3 font-mono text-zinc-300">{{ p.id || '-' }}</td>
                <td class="px-4 py-3 font-medium text-zinc-100">{{ p.title || '-' }}</td>
                <td class="px-4 py-3">
                  <span :class="['px-2 py-1 rounded text-xs', 
                    p.difficulty === 'easy' ? 'bg-emerald-900/50 text-emerald-400' : 
                    p.difficulty === 'medium' ? 'bg-amber-900/50 text-amber-400' : 'bg-rose-900/50 text-rose-400'
                  ]">
                    {{ p.difficulty || '-' }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  {{ p.submission_count ? Math.min(Math.round(p.accepted_count * 100 / p.submission_count), 100) : 0 }}%
                </td>
                <td class="px-4 py-3 text-right">
                  <button @click="editProblem(p)" class="text-blue-400 hover:text-blue-300 text-sm">编辑</button>
                  <button @click="deleteProblem(p.id)" class="text-red-400 hover:text-red-300 text-sm ml-2">删除</button>
                </td>
              </tr>
              <tr v-if="!loading && !problems.length">
                <td colspan="5" class="px-4 py-10 text-center text-zinc-400">
                  暂无题目
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- 编辑题目 -->
      <div v-if="activeTab === 'edit'" class="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
        <h2 class="text-lg font-semibold mb-4 text-zinc-100">{{ editingProblem ? '编辑题目' : '创建新题目' }}</h2>
        
        <div class="space-y-4">
          <!-- 基本信息 -->
          <div>
            <label class="block text-sm font-medium text-zinc-300 mb-1">标题</label>
            <input v-model="problemForm.title" class="w-full bg-zinc-900 text-zinc-100 border border-zinc-600 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500" placeholder="题目标题">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-zinc-300 mb-1">难度</label>
            <select v-model="problemForm.difficulty" class="w-full bg-zinc-900 text-zinc-100 border border-zinc-600 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500">
              <option value="easy">简单</option>
              <option value="medium">中等</option>
              <option value="hard">困难</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-zinc-300 mb-1">题号</label>
            <input v-model="problemForm.id" type="number" :disabled="!!editingProblem" class="w-full bg-zinc-900 text-zinc-100 border border-zinc-600 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" placeholder="题号">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-zinc-300 mb-1">标题</label>
            <input v-model="problemForm.title" class="w-full bg-zinc-900 text-zinc-100 border border-zinc-600 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500" placeholder="题目标题">
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-zinc-300 mb-1">时间限制 (ms)</label>
              <input v-model.number="problemForm.time_limit_ms" type="number" class="w-full bg-zinc-900 text-zinc-100 border border-zinc-600 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500" placeholder="1000">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-zinc-300 mb-1">内存限制 (MB)</label>
              <input v-model.number="problemForm.memory_limit_mb" type="number" class="w-full bg-zinc-900 text-zinc-100 border border-zinc-600 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500" placeholder="256">
            </div>
          </div>
          
          <!-- Markdown 编辑区 -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-sm font-medium text-zinc-300">题目内容 (Markdown)</label>
              <button @click="loadTemplate" class="text-xs text-blue-400 hover:text-blue-300">加载模板</button>
            </div>
            <textarea 
              v-model="markdownContent" 
              class="w-full min-h-[400px] bg-zinc-900 text-zinc-100 border border-zinc-600 rounded-md px-4 py-3 font-mono text-sm focus:outline-none focus:border-blue-500"
              placeholder="在此输入题目描述、输入输出格式、样例等..."></textarea>
            
            <div class="mt-2 text-xs text-zinc-500">
              <details>
                <summary class="cursor-pointer hover:text-zinc-300">查看 Markdown 语法提示</summary>
                <div class="mt-2 p-2 bg-zinc-900 rounded text-xs font-mono text-zinc-400">
                  <div><strong>标题:</strong> ## 题目描述, ### 输入格式</div>
                  <div><strong>格式:</strong> **粗体**, *斜体*, `代码`</div>
                  <div><strong>LaTeX:</strong> 行内 $E=mc^2$, 块级 $$\sum_{i=1}^n i$$</div>
                  <div><strong>代码块:</strong> ```cpp\ncode here\n```</div>
                  <div><strong>样例:</strong> 用 ## 样例输入 和 ## 样例输出 标记</div>
                </div>
              </details>
            </div>
          </div>
          
          <!-- 测试点管理 -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-sm font-medium text-zinc-300">评测点数据</label>
              <button @click="addTestCase" class="text-xs text-blue-400 hover:text-blue-300">+ 添加测试点</button>
            </div>
            
            <!-- 批量文件上传 -->
            <div class="mb-4 p-4 bg-zinc-900 border border-zinc-700">
              <label class="text-xs text-zinc-400 mb-1 block">批量上传测试点文件</label>
              <input 
                type="file" 
                @change="handleTestCaseFile"
                class="text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-400 hover:file:bg-zinc-700"
                accept=".txt"
              >
              <div class="text-xs text-zinc-500 mt-1">文件格式：奇数行是输入，偶数行是输出</div>
            </div>
            
            <div class="space-y-2">
              <div v-for="(tc, index) in testCases" :key="index" class="bg-zinc-900 border border-zinc-600 p-3">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs text-zinc-400">测试点 #{{ index + 1 }}</span>
                  <button @click="removeTestCase(index)" v-if="testCases.length > 1" class="text-xs text-red-400 hover:text-red-300">删除</button>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="text-xs text-zinc-400 mb-1 block">输入</label>
                    <textarea 
                      v-model="tc.input" 
                      class="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                      rows="2"
                      placeholder="输入数据"
                    ></textarea>
                  </div>
                  <div>
                    <label class="text-xs text-zinc-400 mb-1 block">输出</label>
                    <textarea 
                      v-model="tc.output" 
                      class="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                      rows="2"
                      placeholder="输出数据"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="flex gap-2">
            <button @click="saveProblem" :disabled="loading" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors disabled:opacity-50">保存</button>
            <button @click="activeTab = 'problems'" class="border border-zinc-600 hover:border-zinc-500 text-zinc-300 px-4 py-2 rounded-md text-sm transition-colors">取消</button>
          </div>
        </div>
      </div>
      
      <!-- 用户管理 -->
      <div v-if="activeTab === 'users'" class="space-y-4">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold text-zinc-100">用户列表</h2>
          <button @click="loadUsers" :disabled="loadingUsers" class="border border-zinc-600 hover:border-zinc-500 text-zinc-300 px-4 py-2 rounded-md text-sm transition-colors">刷新</button>
        </div>
        
        <div class="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-zinc-750 border-b border-zinc-700 text-zinc-400">
              <tr>
                <th class="text-left px-4 py-3 font-medium">ID</th>
                <th class="text-left px-4 py-3 font-medium">用户名</th>
                <th class="text-left px-4 py-3 font-medium">邮箱</th>
                <th class="text-left px-4 py-3 font-medium">角色</th>
                <th class="text-right px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-700">
              <tr v-for="user in users" :key="user.id" class="hover:bg-zinc-750">
                <td class="px-4 py-3 text-zinc-300">{{ user.id }}</td>
                <td class="px-4 py-3 text-zinc-100">{{ user.username }}</td>
                <td class="px-4 py-3 text-zinc-300">{{ user.email }}</td>
                <td class="px-4 py-3">
                  <select 
                    v-model="user.role" 
                    @change="updateUserRole(user.id, user.role)"
                    class="bg-zinc-900 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                    :disabled="!isSuperAdmin && user.username !== 'admin'"
                  >
                    <option value="user">普通用户</option>
                    <option value="admin">管理员</option>
                  </select>
                </td>
                <td class="px-4 py-3 text-right">
                  <button 
                    @click="openNotificationDialog(user)"
                    class="text-blue-400 hover:text-blue-300 text-xs mr-3"
                  >
                    Send Message
                  </button>
                  <button 
                    @click="deleteUser(user.id)"
                    :disabled="user.username === 'admin'"
                    class="text-red-400 hover:text-red-300 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    删除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <!-- Notification Dialog -->
    <div v-if="showNotificationDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-zinc-800 rounded-lg p-6 w-full max-w-md border border-zinc-700">
        <h3 class="text-lg font-semibold text-zinc-100 mb-4">Send Message to {{ selectedUser?.username }}</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm text-zinc-400 mb-1">Type</label>
            <select v-model="notificationForm.type" class="w-full bg-zinc-900 text-zinc-100 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-zinc-400 mb-1">Title</label>
            <input v-model="notificationForm.title" type="text" class="w-full bg-zinc-900 text-zinc-100 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Notification title">
          </div>
          <div>
            <label class="block text-sm text-zinc-400 mb-1">Message</label>
            <textarea v-model="notificationForm.message" rows="4" class="w-full bg-zinc-900 text-zinc-100 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Notification message"></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button @click="showNotificationDialog = false" class="border border-zinc-600 hover:border-zinc-500 text-zinc-300 px-4 py-2 rounded-md text-sm transition-colors">Cancel</button>
          <button @click="sendNotification" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors">Send</button>
        </div>
      </div>
    </div>
  </div>
</template>