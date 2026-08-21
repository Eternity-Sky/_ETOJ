<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api, type User } from "@/lib/api";

const users = ref<User[]>([]);

onMounted(async () => {
  users.value = await api.get("/api/rankings");
});
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-2xl font-bold">排行榜</h1>
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-zinc-50 border-b border-zinc-200 text-zinc-600">
          <tr>
            <th class="text-left px-4 py-3 font-medium w-16">排名</th>
            <th class="text-left px-4 py-3 font-medium">用户</th>
            <th class="text-right px-4 py-3 font-medium w-28">通过题目</th>
            <th class="text-right px-4 py-3 font-medium w-28">提交次数</th>
            <th
              class="text-right px-4 py-3 font-medium w-32 hidden sm:table-cell"
            >
              注册时间
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(u, i) in users"
            :key="u.id"
            class="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50"
          >
            <td class="px-4 py-3">
              <span v-if="i === 0" class="text-amber-500 font-bold">🥇</span>
              <span v-else-if="i === 1" class="text-zinc-500 font-bold"
                >🥈</span
              >
              <span v-else-if="i === 2" class="text-orange-600 font-bold"
                >🥉</span
              >
              <span v-else class="text-zinc-500 font-medium">{{ i + 1 }}</span>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <span
                  class="h-7 w-7 inline-flex items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold"
                  >{{ u.username[0].toUpperCase() }}</span
                >
                <span class="font-medium">{{ u.username }}</span>
                <span
                  v-if="u.role === 'admin'"
                  class="tag bg-purple-100 text-purple-700"
                  >管理员</span
                >
              </div>
            </td>
            <td class="px-4 py-3 text-right font-semibold text-emerald-600">
              {{ u.solved_count }}
            </td>
            <td class="px-4 py-3 text-right text-zinc-600">
              {{ u.submissions_count }}
            </td>
            <td
              class="px-4 py-3 text-right text-zinc-500 text-xs hidden sm:table-cell"
            >
              {{ new Date(u.created_at!).toLocaleDateString() }}
            </td>
          </tr>
          <tr v-if="!users.length">
            <td colspan="5" class="px-4 py-10 text-center text-zinc-500">
              暂无用户，注册账号登上榜首
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
