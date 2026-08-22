<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { api } from '@/lib/api'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'

const currentUser = ref<any>(null)
const stats = ref({ submissions: 0, users: 0, problems: 0 })
const loading = ref(false)
const message = ref('')
const activeTab = ref<'stats' | 'problems' | 'edit'>('stats')
const problems = ref<any[]>([])
const editingProblem = ref<any>(null)
const problemForm = ref({
  id: '',
  title: '',
  description: '',
  input_format: '',
  output_format: '',
  sample_input: '',
  sample_output: '',
  time_limit_ms: 1000,
  memory_limit_mb: 256,
  difficulty: 'easy',
  test_cases_json: '[{"input":"","output":""}]'
})

const markdownContent = ref('')
const testCases = ref<{input: string, output: string}[]>([{input: '', output: ''}])

async function loadMe() {
  try {
    const me = await api.get('/api/auth/me')
    currentUser.value = me
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
    message.value = e.message || '加载统计失败'
  } finally {
    loading.value = false
  }
}

async function loadProblems() {
  try {
    loading.value = true
    const data = await api.get('/api/problems')
    console.log('题目列表API响应:', data)
    problems.value = data.items || []
    console.log('赋值后的题目数组:', problems.value)
  } catch (e: any) {
    message.value = e.message || '加载题目失败'
  } finally {
    loading.value = false
  }
}

async function clearSubmissions() {
  if (!confirm('确定要清空所有提交记录吗？此操作不可撤销。')) return
  
  try {
    loading.value = true
    const result = await api.post('/api/admin/clear-submissions')
    message.value = result.message || '清空成功'
    await loadStats()
  } catch (e: any) {
    message.value = e.message || '清空失败'
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
  
  // 合并为markdown格式
  markdownContent.value = generateMarkdown()
  console.log('表单数据:', problemForm.value)
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
    sample_input: '',
    sample_output: '',
    time_limit_ms: 1000,
    memory_limit_mb: 256,
    difficulty: 'easy',
    test_cases_json: '[{"input":"","output":""}]'
  }
  testCases.value = [{input: '', output: ''}]
  markdownContent.value = '' // 新建时不预填模板
  activeTab.value = 'edit'
}

function generateMarkdown(): string {
  let md = ''
  
  if (problemForm.value.description) {
    md += `## 题目描述\n\n${problemForm.value.description}\n\n`
  }
  
  if (problemForm.value.input_format) {
    md += `## 输入格式\n\n${problemForm.value.input_format}\n\n`
  }
  
  if (problemForm.value.output_format) {
    md += `## 输出格式\n\n${problemForm.value.output_format}\n\n`
  }
  
  if (problemForm.value.sample_input) {
    md += `## 样例输入\n\n\`\`\`\n${problemForm.value.sample_input}\n\`\`\`\n\n`
  }
  
  if (problemForm.value.sample_output) {
    md += `## 样例输出\n\n\`\`\`\n${problemForm.value.sample_output}\n\`\`\`\n\n`
  }
  
  return md.trim()
}

function parseMarkdown(): void {
  const md = markdownContent.value
  if (!md) return
  
  // 更健壮的Markdown解析
  const sections = md.split(/##\s+/)
  
  // 解析各个部分
  sections.forEach(section => {
    const lines = section.trim().split('\n')
    if (lines.length === 0) return
    
    const title = lines[0]?.trim()
    const content = lines.slice(1).join('\n').trim()
    
    if (title === '题目描述') {
      problemForm.value.description = content
    } else if (title === '输入格式') {
      problemForm.value.input_format = content
    } else if (title === '输出格式') {
      problemForm.value.output_format = content
    } else if (title === '样例输入') {
      // 提取代码块内容，支持多种格式
      const codeMatch = content.match(/```(?:\w+)?\n([\s\S]*?)```/)
      problemForm.value.sample_input = codeMatch ? codeMatch[1].trim() : content
    } else if (title === '样例输出') {
      const codeMatch = content.match(/```(?:\w+)?\n([\s\S]*?)```/)
      problemForm.value.sample_output = codeMatch ? codeMatch[1].trim() : content
    }
  })
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
    
    // 从markdown解析到表单
    parseMarkdown()
    
    // 更新测试点JSON
    updateTestCasesJson()
    
    if (editingProblem.value) {
      await api.put(`/api/problems/${editingProblem.value.id}`, problemForm.value)
      message.value = '题目更新成功'
    } else {
      await api.post('/api/problems', problemForm.value)
      message.value = '题目创建成功'
    }
    
    await loadProblems()
    activeTab.value = 'problems'
  } catch (e: any) {
    message.value = e.message || '保存失败'
  } finally {
    loading.value = false
  }
}

async function deleteProblem(id: number) {
  if (!confirm('确定要删除这个题目吗？')) return
  
  try {
    loading.value = true
    await api.del(`/api/problems/${id}`)
    message.value = '题目删除成功'
    await loadProblems()
  } catch (e: any) {
    message.value = e.message || '删除失败'
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

function updateTestCasesJson() {
  problemForm.value.test_cases_json = JSON.stringify(testCases.value.filter(tc => tc.input || tc.output))
}

// 监听markdown内容变化，自动解析到表单
watch(markdownContent, () => {
  parseMarkdown()
})

// 监听测试点变化，自动更新JSON
watch(testCases, () => {
  updateTestCasesJson()
}, { deep: true })

// 监听表单变化，自动更新markdown（避免循环）
watch(() => [problemForm.value.description, problemForm.value.input_format, problemForm.value.output_format, problemForm.value.sample_input, problemForm.value.sample_output], () => {
  if (!editingProblem.value) { // 只在新建时自动更新
    markdownContent.value = generateMarkdown()
  }
}, { deep: true })

onMounted(() => {
  loadMe()
  if (currentUser.value?.username !== 'admin') {
    message.value = '需要管理员权限'
    return
  }
  loadStats()
})
</script>

<template>
  <div class="max-w-6xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6 text-zinc-100">后台管理</h1>
    
    <div v-if="!currentUser || currentUser.username !== 'admin'" class="bg-red-900/30 border border-red-800 text-red-400 p-4 rounded-lg">
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
          </div>
        </div>
      </div>
      
      <!-- 题目管理 -->
      <div v-if="activeTab === 'problems'" class="space-y-4">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold text-zinc-100">题目列表</h2>
          <button @click="createNewProblem" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors">创建新题目</button>
        </div>
        
        <div class="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
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
          
          <!-- 样例输入输出 -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-zinc-300 mb-1">样例输入</label>
              <textarea 
                v-model="problemForm.sample_input" 
                class="w-full bg-zinc-900 text-zinc-100 border border-zinc-600 rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:border-blue-500"
                rows="3"
                placeholder="样例输入数据"
              ></textarea>
            </div>
            <div>
              <label class="block text-sm font-medium text-zinc-300 mb-1">样例输出</label>
              <textarea 
                v-model="problemForm.sample_output" 
                class="w-full bg-zinc-900 text-zinc-100 border border-zinc-600 rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:border-blue-500"
                rows="3"
                placeholder="样例输出数据"
              ></textarea>
            </div>
          </div>
          
          <!-- 测试点管理 -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-sm font-medium text-zinc-300">测试点</label>
              <button @click="addTestCase" class="text-xs text-blue-400 hover:text-blue-300">+ 添加测试点</button>
            </div>
            <div class="space-y-2">
              <div v-for="(tc, index) in testCases" :key="index" class="bg-zinc-900 border border-zinc-600 rounded-md p-3">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs text-zinc-400">测试点 #{{ index + 1 }}</span>
                  <button @click="removeTestCase(index)" v-if="testCases.length > 1" class="text-xs text-red-400 hover:text-red-300">删除</button>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="text-xs text-zinc-400 mb-1 block">输入</label>
                    <textarea 
                      v-model="tc.input" 
                      class="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                      rows="2"
                      placeholder="输入数据"
                    ></textarea>
                  </div>
                  <div>
                    <label class="text-xs text-zinc-400 mb-1 block">输出</label>
                    <textarea 
                      v-model="tc.output" 
                      class="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
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
      
      <div v-if="message" class="mt-4 p-3 rounded-lg" :class="message.includes('成功') ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'">
        {{ message }}
      </div>
    </div>
  </div>
</template>