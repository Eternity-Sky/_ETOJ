<script setup lang="ts">
import { RouterLink } from "vue-router";
import { ref, onMounted, computed } from "vue";
import {
  api,
  type Submission,
  STATUS_COLOR,
  STATUS_LABEL,
  DIFFICULTY_COLOR,
  DIFFICULTY_LABEL,
} from "@/lib/api";

const items = ref<Submission[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;

const totalPages = computed(() => Math.ceil(total.value / pageSize));

async function load() {
  const res = await api.get<any>(
    `/api/submissions?page=${page.value}&pageSize=${pageSize}`,
  );
  items.value = res.items || [];
  total.value = res.total || 0;
}

onMounted(load);
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-2xl font-bold">我的提交</h1>
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-zinc-50 border-b border-zinc-200 text-zinc-600">
          <tr>
            <th class="text-left px-4 py-3 font-medium w-24">#</th>
            <th class="text-left px-4 py-3 font-medium">题目</th>
            <th class="text-left px-4 py-3 font-medium w-36">语言</th>
            <th class="text-left px-4 py-3 font-medium w-32">状态</th>
            <th
              class="text-right px-4 py-3 font-medium w-24 hidden sm:table-cell"
            >
              用时
            </th>
            <th
              class="text-right px-4 py-3 font-medium w-24 hidden sm:table-cell"
            >
              内存
            </th>
            <th
              class="text-right px-4 py-3 font-medium w-44 hidden md:table-cell"
            >
              提交时间
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="s in items"
            :key="s.id"
            class="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50"
          >
            <td class="px-4 py-3">
              <RouterLink
                :to="`/submission/${s.id}`"
                class="link font-mono text-xs"
                >#{{ s.id }}</RouterLink
              >
            </td>
            <td class="px-4 py-3">
              <RouterLink
                :to="`/problem/${s.problem_slug}`"
                class="link font-medium"
                >{{ s.problem_title }}</RouterLink
              >
            </td>
            <td class="px-4 py-3 text-zinc-600 uppercase">{{ s.language }}</td>
            <td class="px-4 py-3">
              <span
                :class="[
                  'tag',
                  STATUS_COLOR[s.status as keyof typeof STATUS_COLOR],
                ]"
                >{{
                  STATUS_LABEL[s.status as keyof typeof STATUS_LABEL] ||
                  s.status
                }}</span
              >
            </td>
            <td
              class="px-4 py-3 text-right text-zinc-600 font-mono text-xs hidden sm:table-cell"
            >
              {{ s.run_time_ms ?? "-" }} ms
            </td>
            <td
              class="px-4 py-3 text-right text-zinc-600 font-mono text-xs hidden sm:table-cell"
            >
              {{ s.memory_kb ? (s.memory_kb / 1024).toFixed(1) + " MB" : "-" }}
            </td>
            <td
              class="px-4 py-3 text-right text-zinc-500 text-xs hidden md:table-cell"
            >
              {{ new Date(s.created_at).toLocaleString() }}
            </td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="7" class="px-4 py-10 text-center text-zinc-500">
              暂无提交记录
            </td>
          </tr>
        </tbody>
      </table>
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-between px-4 py-3 border-t border-zinc-100 text-sm"
      >
        <span class="text-zinc-500">共 {{ total }} 条</span>
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
