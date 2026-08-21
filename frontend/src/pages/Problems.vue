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
    let list: Problem[] = res.items || [];
    if (keyword.value) {
      const k = keyword.value.toLowerCase();
      list = list.filter(
        (p) => p.title.toLowerCase().includes(k) || p.slug.includes(k),
      );
    }
    items.value = list;
    total.value = keyword.value ? list.length : res.total || 0;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-5">
    <div
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <h1 class="text-2xl font-bold">题目列表</h1>
      <div class="flex flex-wrap items-center gap-2">
        <input
          v-model="keyword"
          @input="load"
          placeholder="搜索题目..."
          class="input sm:w-56"
        />
        <select
          v-model="difficulty"
          @change="
            page = 1;
            load();
          "
          class="input sm:w-32"
        >
          <option value="">全部难度</option>
          <option value="easy">简单</option>
          <option value="medium">中等</option>
          <option value="hard">困难</option>
        </select>
      </div>
    </div>

    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-zinc-50 border-b border-zinc-200 text-zinc-600">
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
            class="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50"
          >
            <td class="px-4 py-3 text-zinc-500 font-mono text-xs">
              {{ p.id }}
            </td>
            <td class="px-4 py-3">
              <RouterLink :to="`/problem/${p.slug}`" class="link font-medium">{{
                p.title
              }}</RouterLink>
            </td>
            <td class="px-4 py-3">
              <span :class="['tag', DIFFICULTY_COLOR[p.difficulty]]">{{
                DIFFICULTY_LABEL[p.difficulty]
              }}</span>
            </td>
            <td class="px-4 py-3 text-right text-zinc-500 hidden sm:table-cell">
              {{ p.submission_count }}
            </td>
            <td class="px-4 py-3 text-right hidden sm:table-cell">
              <span class="font-medium text-emerald-600">
                {{
                  p.submission_count
                    ? Math.round((p.accepted_count * 100) / p.submission_count)
                    : 0
                }}%
              </span>
            </td>
          </tr>
          <tr v-if="!loading && !items.length">
            <td colspan="5" class="px-4 py-10 text-center text-zinc-500">
              暂无题目
            </td>
          </tr>
        </tbody>
      </table>
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-between px-4 py-3 border-t border-zinc-100 text-sm"
      >
        <span class="text-zinc-500">共 {{ total }} 题</span>
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
