<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ref, onMounted, computed, watch } from 'vue'
import { api, type Problem, type SubmissionStatus, DIFFICULTY_COLOR, DIFFICULTY_LABEL, LANGUAGES, STATUS_COLOR, STATUS_LABEL } from '@/lib/api'

const props = defineProps<{ slug: string }>()
const problem = ref<Problem | null>(null)
const tab = ref<'description' | 'submissions'>('description')

const language = ref('cpp')
const code = ref('')
const submitting = ref(false)
const lastSubmissionId = ref<number | null>(null)
const pollTimer = ref<any>(null)
const pollStatus = ref<SubmissionStatus | null>(null)
const pollDetail = ref<any>(null)

const templates: Record<string, string> = {
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n    cout << a + b << endl;\n    return 0;\n}\n`,
  c: `#include <stdio.h>\n\nint main() {\n    int a, b;\n    scanf("%d %d", &a, &b);\n    printf("%d\\n", a + b);\n    return 0;\n}\n`,
  python3: `import sys\n\ndef main():\n    a, b = map(int, sys.stdin.readline().split())\n    print(a + b)\n\nmain()\n`,
  java: `import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int a = sc.nextInt(), b = sc.nextInt();\n        System.out.println(a + b);\n    }\n}\n`,
  javascript: `const readline = require('readline');\nconst rl = readline.createInterface({ input: process.stdin });\nrl.on('line', line => {\n    const [a, b] = line.split(' ').map(Number);\n    console.log(a + b);\n});\n`,
  typescript: `import * as readline from 'readline';\nconst rl = readline.createInterface({ input: process.stdin });\nrl.on('line', line => {\n    const [a, b] = line.split(' ').map(Number);\n    console.log(a + b);\n});\n`,
  rust: `use std::io;\n\nfn main() {\n    let mut line = String::new();\n    io::stdin().read_line(&mut line).unwrap();\n    let v: Vec<i32> = line.split_whitespace().map(|s| s.parse().unwrap()).collect();\n    println!("{}", v[0] + v[1]);\n}\n`,
  go: `package main\n\nimport "fmt"\n\nfunc main() {\n    var a, b int\n    fmt.Scan(&a, &b)\n    fmt.Println(a + b)\n}\n`,
}

const acceptRate = computed(() => {
  if (!problem.value) return 0
  return problem.value.submission_count ? Math.round(problem.value.accepted_count * 100 / problem.value.submission_count) : 0
})

watch(language, (v) => {
  if (!code.value) code.value = templates[v] || ''
})

async function load() {
  problem.value = await api.get(`/api/problems/${props.slug}`)
  if (!code.value) code.value = templates[language.value] || ''
}

async function submit() {
  if (!code.value.trim()) return alert('请输入代码')
  submitting.value = true
  pollStatus.value = 'pending'
  pollDetail.value = null
  try {
    const res = await api.post<any>('/api/submissions', {
      problemSlug: props.slug,
      language: language.value,
      code: code.value
    })
    lastSubmissionId.value = res.id
    startPoll(res.id)
  } catch (e: any) {
    alert(e.message)
  } finally { submitting.value = false }
}

function startPoll(id: number) {
  let n = 0
  clearInterval(pollTimer.value)
  pollTimer.value = setInterval(async () => {
    try {
      const sub = await api.get<any>(`/api/submissions/${id}`)
      pollStatus.value = sub.status
      pollDetail.value = sub
      if (sub.status !== 'pending' && sub.status !== 'judging') {
        clearInterval(pollTimer.value)
        if (location.hash.startsWith('#submissions')) tab.value = 'submissions'
      }
    } catch {}
    if (n++ > 60) clearInterval(pollTimer.value)
  }, 1500)
}

onMounted(load)
</script>

<template>
  <div v-if="problem" class="space-y-5">
    <div class="flex flex-wrap items-center gap-3">
      <RouterLink to="/problems" class="btn-ghost -ml-2">← 题目列表</RouterLink>
      <h1 class="text-2xl font-bold flex items-center gap-3">
        <span class="text-zinc-400 font-mono text-lg">#{{ problem.id }}</span>
        {{ problem.title }}
      </h1>
      <span :class="['tag', DIFFICULTY_COLOR[problem.difficulty]]">{{ DIFFICULTY_LABEL[problem.difficulty] }}</span>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
      <div class="card p-3"><div class="text-zinc-500 text-xs">时限</div><div class="font-semibold mt-0.5">{{ problem.time_limit_ms }} ms</div></div>
      <div class="card p-3"><div class="text-zinc-500 text-xs">内存</div><div class="font-semibold mt-0.5">{{ problem.memory_limit_mb }} MB</div></div>
      <div class="card p-3"><div class="text-zinc-500 text-xs">提交</div><div class="font-semibold mt-0.5">{{ problem.submission_count }}</div></div>
      <div class="card p-3"><div class="text-zinc-500 text-xs">通过率</div><div class="font-semibold mt-0.5 text-emerald-600">{{ acceptRate }}%</div></div>
    </div>

    <div class="grid lg:grid-cols-5 gap-5">
      <div class="card p-6 lg:col-span-3 space-y-6">
        <div class="flex items-center gap-1 border-b border-zinc-200 -mx-6 -mt-6 px-6 mb-2">
          <button @click="tab = 'description'" :class="['px-4 py-3 text-sm font-medium border-b-2 -mb-px', tab === 'description' ? 'border-brand-600 text-brand-700' : 'border-transparent text-zinc-600 hover:text-zinc-900']">题目描述</button>
          <button @click="tab = 'submissions'" :class="['px-4 py-3 text-sm font-medium border-b-2 -mb-px', tab === 'submissions' ? 'border-brand-600 text-brand-700' : 'border-transparent text-zinc-600 hover:text-zinc-900']">我的提交</button>
        </div>

        <template v-if="tab === 'description'">
          <section>
            <h2 class="text-lg font-semibold mb-2">题目描述</h2>
            <div class="text-zinc-700 leading-relaxed whitespace-pre-wrap">{{ problem.description }}</div>
          </section>
          <section v-if="problem.input_format">
            <h2 class="text-lg font-semibold mb-2">输入格式</h2>
            <div class="text-zinc-700 leading-relaxed whitespace-pre-wrap">{{ problem.input_format }}</div>
          </section>
          <section v-if="problem.output_format">
            <h2 class="text-lg font-semibold mb-2">输出格式</h2>
            <div class="text-zinc-700 leading-relaxed whitespace-pre-wrap">{{ problem.output_format }}</div>
          </section>
          <section class="grid sm:grid-cols-2 gap-4">
            <div>
              <h3 class="text-sm font-semibold text-zinc-600 mb-1">样例输入</h3>
              <pre class="!rounded-lg !text-xs">{{ problem.sample_input || '' }}</pre>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-zinc-600 mb-1">样例输出</h3>
              <pre class="!rounded-lg !text-xs">{{ problem.sample_output || '' }}</pre>
            </div>
          </section>
        </template>

        <template v-else>
          <div v-if="lastSubmissionId && pollStatus" class="mb-4 p-4 rounded-lg border border-zinc-200 bg-zinc-50">
            <div class="flex items-center gap-3">
              <span :class="['tag', STATUS_COLOR[pollStatus]]">{{ STATUS_LABEL[pollStatus] }}</span>
              <RouterLink :to="`/submission/${lastSubmissionId}`" class="link text-sm">查看 #{{ lastSubmissionId }}</RouterLink>
              <span class="text-xs text-zinc-500 ml-auto">
                <span v-if="pollDetail?.run_time_ms">{{ pollDetail.run_time_ms }} ms</span>
                <span v-if="pollDetail?.memory_kb" class="ml-2">{{ (pollDetail.memory_kb / 1024).toFixed(1) }} MB</span>
              </span>
            </div>
          </div>
          <p class="text-sm text-zinc-500">进入 <RouterLink to="/submissions" class="link">提交记录</RouterLink> 查看所有历史提交。</p>
        </template>
      </div>

      <div class="card lg:col-span-2 flex flex-col overflow-hidden">
        <div class="flex items-center justify-between px-4 py-2 border-b border-zinc-200 bg-zinc-50">
          <select v-model="language" class="input !py-1.5 !text-xs !w-40">
            <option v-for="l in LANGUAGES" :key="l.value" :value="l.value">{{ l.label }}</option>
          </select>
          <button @click="code = templates[language] || ''" class="btn-ghost !py-1.5 !text-xs">模板</button>
        </div>
        <textarea
          v-model="code" spellcheck="false"
          class="flex-1 min-h-[380px] w-full resize-none font-mono text-sm p-4 outline-none bg-zinc-950 text-zinc-100"
        ></textarea>
        <div class="p-4 border-t border-zinc-200 flex items-center justify-between gap-2">
          <span class="text-xs text-zinc-500 font-mono">{{ code.length }} chars</span>
          <div class="flex items-center gap-2">
            <button @click="code = ''" class="btn-outline !py-2">清空</button>
            <button @click="submit" :disabled="submitting" class="btn-primary !py-2">
              <svg v-if="submitting" class="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
              {{ submitting ? '提交中...' : '提交代码' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
