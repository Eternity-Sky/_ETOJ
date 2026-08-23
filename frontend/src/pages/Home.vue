<script setup lang="ts">
import { RouterLink } from "vue-router";
import { ref, onMounted } from "vue";
import { api, type Problem } from "@/lib/api";
import { DIFFICULTY_COLOR, DIFFICULTY_LABEL } from "@/lib/api";
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'

const problems = ref<Problem[]>([]);
const stats = ref({ total: 0, users: 0, submissions: 0 });

onMounted(async () => {
  try {
    const res = await api.get<any>("/api/problems?pageSize=6");
    problems.value = res.items || [];
    const rank = await api.get<any[]>("/api/rankings");
    stats.value = {
      total: res.total || 0,
      users: rank.length,
      submissions: problems.value.reduce((s, p) => s + p.submission_count, 0),
    };
  } catch (e) {}
});
</script>

<template>
  <div class="min-h-screen bg-zinc-900 text-zinc-100">
    <div class="max-w-6xl mx-auto px-4 py-8 space-y-12">
      <section class="border border-zinc-700 bg-zinc-800 p-8 sm:p-12">
        <div class="max-w-2xl space-y-5">
          <div class="inline-flex items-center gap-2 border border-zinc-600 bg-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300">
            无服务器架构 · Cloudflare Workers + GitHub Actions
          </div>
          <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-100">
            写代码，提交，评测
            <span class="block text-zinc-400 mt-1">轻量纯粹的在线评测系统</span>
          </h1>
          <p class="text-zinc-400 leading-relaxed">
            ETOJ 是一个完全基于无服务器架构的在线评测系统。数据存储在 Cloudflare
            D1， 评测任务由 GitHub Actions 编译运行，全程无需维护服务器。
          </p>
          <div class="flex flex-wrap gap-3">
            <RouterLink to="/problems" class="bg-zinc-700 text-white px-5 py-2.5 hover:bg-zinc-600">开始刷题 →</RouterLink>
            <RouterLink to="/rankings" class="border border-zinc-600 text-zinc-300 px-5 py-2.5 hover:bg-zinc-700 hover:text-zinc-100">查看排行榜</RouterLink>
          </div>
          <div class="grid grid-cols-3 gap-4 pt-4 max-w-md">
            <div>
              <div class="text-2xl font-bold text-zinc-100">
                {{ stats.total }}
              </div>
              <div class="text-xs text-zinc-500 mt-0.5">题目数</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-zinc-100">
                {{ stats.users }}
              </div>
              <div class="text-xs text-zinc-500 mt-0.5">用户数</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-zinc-100">
                {{ stats.submissions }}
              </div>
              <div class="text-xs text-zinc-500 mt-0.5">提交次数</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold">最新题目</h2>
          <RouterLink to="/problems" class="text-zinc-400 hover:text-zinc-200 text-sm">查看全部 →</RouterLink>
        </div>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <RouterLink
            v-for="p in problems"
            :key="p.id"
            :to="`/problem/${p.id}`"
            class="bg-zinc-800 border border-zinc-700 p-5 hover:border-zinc-600"
          >
            <div class="flex items-start justify-between gap-3 mb-3">
              <div class="font-semibold text-zinc-100">
                #{{ p.id }} · {{ p.title }}
              </div>
              <span :class="['px-2 py-1 text-xs', 
                p.difficulty === 'easy' ? 'bg-zinc-700 text-zinc-300' : 
                p.difficulty === 'medium' ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-700 text-zinc-300'
              ]">{{
                DIFFICULTY_LABEL[p.difficulty]
              }}</span>
            </div>
            <div class="text-sm text-zinc-400 line-clamp-2 mb-4">
              {{ p.description }}
            </div>
            <div class="flex items-center justify-between text-xs text-zinc-500 pt-3 border-t border-zinc-700">
              <span>提交 {{ p.submission_count }}</span>
              <span>
                通过
                <span class="text-zinc-300 font-medium">
                  {{
                    p.submission_count
                      ? Math.round((p.accepted_count * 100) / p.submission_count)
                      : 0
                  }}%
                </span>
              </span>
            </div>
          </RouterLink>
          <div
            v-if="!problems.length"
            class="bg-zinc-800 border border-zinc-700 p-8 text-center text-zinc-400 col-span-full"
          >
            暂无题目，运行
            <code class="text-xs bg-zinc-700 px-1.5 py-0.5">npm run seed</code>
            添加示例题目
          </div>
        </div>
      </section>

      <section class="grid sm:grid-cols-3 gap-4">
        <div class="bg-zinc-800 border border-zinc-700 p-5">
          <div class="h-10 w-10 bg-zinc-700 text-zinc-400 flex items-center justify-center mb-3">
            <svg
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"
              />
            </svg>
          </div>
          <h3 class="font-semibold mb-1 text-zinc-100">Cloudflare Workers</h3>
          <p class="text-sm text-zinc-400">
            API 服务部署在 Cloudflare 边缘节点，全球低延迟访问，按请求付费。
          </p>
        </div>
        <div class="bg-zinc-800 border border-zinc-700 p-5">
          <div class="h-10 w-10 bg-zinc-700 text-zinc-400 flex items-center justify-center mb-3">
            <svg
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 class="font-semibold mb-1 text-zinc-100">GitHub Actions 评测</h3>
          <p class="text-sm text-zinc-400">
            提交代码通过 repository_dispatch
            触发工作流，隔离容器中编译运行测试用例。
          </p>
        </div>
        <div class="bg-zinc-800 border border-zinc-700 p-5">
          <div class="h-10 w-10 bg-zinc-700 text-zinc-400 flex items-center justify-center mb-3">
            <svg
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3zM9 12h6"
              />
            </svg>
          </div>
          <h3 class="font-semibold mb-1 text-zinc-100">D1 数据库</h3>
          <p class="text-sm text-zinc-400">
            SQLite 兼容的分布式数据库，支持跨节点复制，存储用户、题目、提交记录。
          </p>
        </div>
      </section>
    </div>
  </div>
</template>