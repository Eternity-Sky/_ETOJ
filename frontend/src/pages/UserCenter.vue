<script setup lang="ts">
import { RouterLink } from "vue-router";
import { ref, onMounted, computed } from "vue";
import { api, type User, STATUS_COLOR, STATUS_LABEL } from "@/lib/api";
import { useToast } from "@/lib/toast";
import UserLink from "@/components/UserLink.vue";

const { success, error: toastError } = useToast();

const user = ref<User | null>(null);
const recent = ref<any[]>([]);
const showEmailDialog = ref(false);
const newEmail = ref("");
const showProfileDialog = ref(false);
const avatarUrl = ref("");
const bio = ref("");
const savingProfile = ref(false);

async function load() {
  user.value = await api.get("/api/auth/me");
  const res = await api.get<any>("/api/submissions?pageSize=10");
  recent.value = res.items || [];
}

async function updateEmail() {
  if (!newEmail.value) {
    toastError("Email is required");
    return;
  }
  
  try {
    await api.updateEmail(newEmail.value);
    success("Email updated successfully");
    showEmailDialog.value = false;
    newEmail.value = "";
    await load();
  } catch (e: any) {
    toastError(e.message || "Failed to update email");
  }
}

function openEmailDialog() {
  newEmail.value = user.value?.email || "";
  showEmailDialog.value = true;
}

function openProfileDialog() {
  avatarUrl.value = user.value?.avatar_url || "";
  bio.value = user.value?.bio || "";
  showProfileDialog.value = true;
}

async function updateProfile() {
  savingProfile.value = true;

  try {
    await api.put("/api/auth/profile", {
      avatar_url: avatarUrl.value.trim(),
      bio: bio.value.trim()
    });

    success("个人资料更新成功");

    showProfileDialog.value = false;

    await load();
  } catch (e: any) {
    toastError(e.message || "个人资料更新失败");
  } finally {
    savingProfile.value = false;
  }
}

const solveRate = computed(() => {
  if (!user.value) return 0;
  if (!user.value.submissions_count || user.value.submissions_count === 0) return 0;
  const rate = Math.round((user.value.solved_count * 100) / user.value.submissions_count);
  return Math.min(rate, 100);
});

onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <div v-if="user" class="card p-6 sm:p-8">
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div class="relative">
          <div class="h-16 w-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            <img
              v-if="user.avatar_url"
              :src="user.avatar_url"
              :alt="`${user.username} 的头像`"
              class="h-16 w-16 rounded-2xl object-cover"
              loading="lazy"
              @error="($event.target as HTMLImageElement).style.display = 'none'"
            />
            <span v-else>{{ user.username[0].toUpperCase() }}</span>
          </div>
          <button
            @click="openProfileDialog"
            class="absolute -bottom-1 -right-1 bg-white border border-zinc-200 rounded-full p-1.5 shadow-sm hover:bg-zinc-50 transition-colors"
            title="编辑个人资料"
          >
            <svg class="w-3 h-3 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
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
            <span @click="openEmailDialog" class="cursor-pointer hover:text-zinc-700 underline">
              {{ user.email || 'No email set' }}
            </span>
            · 注册于
            {{ new Date(user.created_at!).toLocaleDateString() }}
          </div>
          <div v-if="user.bio" class="text-sm text-zinc-600 mt-1">
            {{ user.bio }}
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
                :to="`/problem/${s.problem_id}`"
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
    
    <!-- Email Update Dialog -->
    <div v-if="showEmailDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md border border-zinc-200">
        <h3 class="text-lg font-semibold mb-4">Update Email</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm text-zinc-600 mb-1">Email Address</label>
            <input
              v-model="newEmail"
              type="email"
              class="w-full border border-zinc-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="your@email.com"
            >
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button @click="showEmailDialog = false" class="border border-zinc-300 hover:border-zinc-400 text-zinc-700 px-4 py-2 rounded-md text-sm transition-colors">Cancel</button>
          <button @click="updateEmail" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors">Update</button>
        </div>
      </div>
    </div>

    <!-- Profile Edit Dialog -->
    <div v-if="showProfileDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md border border-zinc-200">
        <h3 class="text-lg font-semibold mb-4">编辑个人资料</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm text-zinc-600 mb-1">头像 URL</label>
            <input
              v-model="avatarUrl"
              type="text"
              class="w-full border border-zinc-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="https://example.com/avatar.png"
            >
            <p class="text-xs text-zinc-500 mt-1">留空则使用首字母头像</p>
          </div>
          <div>
            <label class="block text-sm text-zinc-600 mb-1">个人简介</label>
            <textarea
              v-model="bio"
              rows="3"
              maxlength="500"
              class="w-full border border-zinc-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
              placeholder="介绍一下自己..."
            ></textarea>
            <p class="text-xs text-zinc-500 mt-1">{{ bio.length }}/500</p>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button @click="showProfileDialog = false" class="border border-zinc-300 hover:border-zinc-400 text-zinc-700 px-4 py-2 rounded-md text-sm transition-colors">取消</button>
          <button
            @click="updateProfile"
            :disabled="savingProfile"
            class="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white px-4 py-2 rounded-md text-sm transition-colors"
          >
            {{ savingProfile ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
