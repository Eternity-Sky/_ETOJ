<script setup lang="ts">
import { RouterLink } from "vue-router";
import { ref, onMounted, computed } from "vue";
import {
  api,
  type Problem,
  DIFFICULTY_COLOR,
  DIFFICULTY_LABEL,
} from "@/lib/api";

const items = ref<Problem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const difficulty = ref("");
const keyword = ref("");
const loading = ref(false);

const totalPages = computed(() => Math.ceil(total.value / pageSize));

async function load() {
  loading.value = true;
  try {
    let q = `/api/problems?page=${page.value}&pageSize=${pageSize}`;
    if (difficulty.value) q += `&difficulty=${difficulty.value}`;
    
    const res = await api.get<any>(q);
    
    console.log(`API响应:`, res);
    let list: Problem[] = res.items || [];
    if (keyword.value) {
      const k = keyword.value.toLowerCase();
      list = list.filter(
        (p) => p.title.toLowerCase().includes(k) || p.slug.includes(k),
      );
    }
    
    items.value = list;
    total.value = keyword.value ? list.length : res.total || 0;
  } catch (e: any) {
    console.error('Load failed:', e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="min-h-screen bg-zinc-900 text-zinc-100">
    <div class="max-w-6xl mx-auto px-4 py-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 class="text-2xl font-bold">题目列表</h1>
        
        <div v-if="loading" class="flex items-center gap-2 text-sm text-zinc-400">
          <div class="w-4 h-4 border-2 border-zinc-700 border-t-zinc-400 animate-spin"></div>
          <span>加载中...</span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="keyword"
            @input="load"
            placeholder="搜索题目..."
            class="bg-zinc-800 text-zinc-100 sm:w-56 px-3 py-2 border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
          <select
            v-model="difficulty"
            @change="
              page = 1;
              load();
            "
            class="bg-zinc-800 text-zinc-100 sm:w-32 px-3 py-2 border border-zinc-700 focus:outline-none focus:border-zinc-500"
          >
            <option value="">全部难度</option>
            <option value="easy">简单</option>
            <option value="medium">中等</option>
            <option value="hard">困难</option>
          </select>
        </div>
      </div>

      <div class="bg-zinc-800 border border-zinc-700">
        <table class="w-full text-sm">
          <thead class="bg-zinc-750 border-b border-zinc-700 text-zinc-400">
            <tr>
              <th class="text-left px-4 py-3 font-medium w-16">#</th>
              <th class="text-left px-4 py-3 font-medium">题目</th>
              <th class="text-left px-4 py-3 font-medium w-24">难度</th>
              <th
                class="text-right px-4 py-3 font-medium w-24 hidden sm:table-cell"
              >
                提交
              </th>
              <th
                class="text-right px-4 py-3 font-medium w-24 hidden sm:table-cell"
              >
                通过率
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in items"
              :key="p.id"
              class="border-b border-zinc-700 last:border-0 hover:bg-zinc-750/50"
            >
              <td class="px-4 py-3 text-zinc-400 font-mono text-xs">
                {{ p.id }}
              </td>
              <td class="px-4 py-3">
                <RouterLink :to="`/problem/${p.id}`" class="text-blue-400 hover:text-blue-300 font-medium">{{
                  p.title
                }}</RouterLink>
              </td>
              <td class="px-4 py-3">
                <span :class="['px-2 py-1 text-xs', DIFFICULTY_COLOR[p.difficulty]]">{{
                  DIFFICULTY_LABEL[p.difficulty]
                }}</span>
              </td>
              <td class="px-4 py-3 text-right text-zinc-400 hidden sm:table-cell">
                {{ p.submission_count }}
              </td>
              <td class="px-4 py-3 text-right hidden sm:table-cell">
                <span class="font-medium text-emerald-400">
                  {{
                    p.submission_count
                      ? Math.min(Math.round((p.accepted_count * 100) / p.submission_count), 100)
                      : 0
                  }}%
                </span>
              </td>
            </tr>
            <tr v-if="!loading && !items.length">
              <td colspan="5" class="px-4 py-10 text-center text-zinc-400">
                暂无题目
              </td>
            </tr>
          </tbody>
        </table>
        <div
          v-if="totalPages > 1"
          class="flex items-center justify-between px-4 py-3 border-t border-zinc-700 text-sm"
        >
          <span class="text-zinc-400">共 {{ total }} 题</span>
          <div class="flex items-center gap-1">
            <button
              :disabled="page === 1"
              @click="
                page--;
                load();
              "
              class="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5"
            >
              上一页
            </button>
            <span class="px-3 text-zinc-400">{{ page }} / {{ totalPages }}</span>
            <button
              :disabled="page >= totalPages"
              @click="
                page++;
                load();
              "
              class="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>