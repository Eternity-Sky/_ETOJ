<script setup lang="ts">
import { RouterLink } from "vue-router";
import { ref, onMounted, computed } from "vue";
import { api, type User, STATUS_COLOR, STATUS_LABEL } from "@/lib/api";

const user = ref<User | null>(null);
const recent = ref<any[]>([]);

const solveRate = computed(() => {
  if (!user.value) return 0;
  return user.value.submissions_count
    ? Math.round((user.value.solved_count * 100) / user.value.submissions_count)
    : 0;
});

async function load() {
  user.value = await api.get("/api/auth/me");
  const res = await api.get<any>("/api/submissions?pageSize=10");
  recent.value = res.items || [];
}

onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <div v-if="user" class="card p-6 sm:p-8">
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div
          class="h-16 w-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg"
        >
          {{ user.username[0].toUpperCase() }}
        </div>
        <div class="flex-1">
          <div class="flex flex-wrap items-center gap-2 mb-1">
            <h1 class="text-2xl font-bold">{{ user.username }}</h1>
            <span
              v-if="user.role === 'admin'"
              class="tag bg-purple-100 text-purple-700"
              >管理员</span
            >
          </div>
          <div class="text-sm text-zinc-500">
            {{ user.email }} · 注册于
            {{ new Date(user.created_at!).toLocaleDateString() }}
          </div>
        </div>
        <div class="flex gap-2">
          <RouterLink to="/submissions" class="btn-outline"
            >我的提交</RouterLink
          >
          <RouterLink to="/problems" class="btn-primary">开始刷题</RouterLink>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-zinc-100">
        <div>
          <div class="text-3xl font-bold text-emerald-600">
            {{ user.solved_count }}
          </div>
          <div class="text-xs text-zinc-500 mt-1">通过题目</div>
        </div>
        <div>
          <div class="text-3xl font-bold text-zinc-900">
            {{ user.submissions_count }}
          </div>
          <div class="text-xs text-zinc-500 mt-1">总提交</div>
        </div>
        <div>
          <div class="text-3xl font-bold text-brand-600">{{ solveRate }}%</div>
          <div class="text-xs text-zinc-500 mt-1">通过率</div>
        </div>
      </div>
    </div>

    <div class="card overflow-hidden">
      <div
        class="px-5 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between"
      >
        <h2 class="font-semibold">最近提交</h2>
        <RouterLink to="/submissions" class="link text-sm">查看全部</RouterLink>
      </div>
      <table class="w-full text-sm">
        <tbody>
          <tr
            v-for="s in recent"
            :key="s.id"
            class="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50"
          >
            <td class="px-5 py-3">
              <RouterLink
                :to="`/submission/${s.id}`"
                class="link font-mono text-xs"
                >#{{ s.id }}</RouterLink
              >
            </td>
            <td class="px-5 py-3">
              <RouterLink
                :to="`/problem/${s.problem_slug}`"
                class="link font-medium"
                >{{ s.problem_title }}</RouterLink
              >
            </td>
            <td class="px-5 py-3 uppercase text-xs text-zinc-600">
              {{ s.language }}
            </td>
            <td class="px-5 py-3">
              <span :class="['tag', STATUS_COLOR[s.status as keyof typeof STATUS_COLOR]]">{{
                STATUS_LABEL[s.status as keyof typeof STATUS_LABEL] || s.status
              }}</span>
            </td>
            <td class="px-5 py-3 text-right text-zinc-500 text-xs">
              {{ new Date(s.created_at).toLocaleString() }}
            </td>
          </tr>
          <tr v-if="!recent.length">
            <td colspan="5" class="px-5 py-10 text-center text-zinc-500">
              还没有提交记录，去
              <RouterLink to="/problems" class="link">刷题</RouterLink> 吧
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
