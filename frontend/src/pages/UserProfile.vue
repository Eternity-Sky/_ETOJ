<script setup lang="ts">
import { ref, onMounted, computed } from "vue"
import { RouterLink, useRoute } from "vue-router"
import { api, type PublicUser } from "@/lib/api"
import { useToast } from "@/lib/toast"

const route = useRoute()
const { error: toastError } = useToast()

const user = ref<PublicUser | null>(null)
const loading = ref(true)

const isMe = computed(() => {
  const token = localStorage.getItem("etoj_token")
  if (!token || !user.value) return false

  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    return Number(payload.sub) === user.value.id
  } catch {
    return false
  }
})

async function load() {
  loading.value = true

  try {
    user.value = await api.get(
      `/api/users/${route.params.uid}` 
    )
  } catch (e: any) {
    toastError(e.message || "用户不存在")
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="max-w-4xl mx-auto">

    <div
      v-if="loading"
      class="py-16 text-center text-zinc-500"
    >
      加载中...
    </div>

    <div
      v-else-if="user"
      class="space-y-5"
    >

      <div class="card p-6">

        <div class="flex items-start gap-5">

          <img
            v-if="user.avatar_url"
            :src="user.avatar_url"
            :alt="`${user.username} 的头像`"
            class="h-20 w-20 rounded-2xl object-cover bg-zinc-800"
          />

          <div
            v-else
            class="h-20 w-20 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center text-3xl font-bold"
          >
            {{ user.username[0].toUpperCase() }}
          </div>

          <div class="flex-1 min-w-0">

            <div class="flex items-center gap-2">
              <h1 class="text-2xl font-bold">
                {{ user.username }}
              </h1>

              <span
                v-if="user.role === 'admin'"
                class="tag bg-purple-100 text-purple-700"
              >
                管理员
              </span>
            </div>

            <p class="mt-2 text-zinc-500 whitespace-pre-wrap">
              {{ user.bio || "这个人很懒，还没有填写简介。" }}
            </p>

            <div class="mt-3 text-sm text-zinc-500">
              注册于
              {{ new Date(user.created_at!).toLocaleDateString() }}
            </div>

          </div>

          <RouterLink
            v-if="isMe"
            to="/me"
            class="btn-outline"
          >
            编辑资料
          </RouterLink>

        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-zinc-200">

          <div>
            <div class="text-2xl font-bold">
              {{ user.solved_count }}
            </div>
            <div class="text-xs text-zinc-500">
              通过题目
            </div>
          </div>

          <div>
            <div class="text-2xl font-bold">
              {{ user.submissions_count }}
            </div>
            <div class="text-xs text-zinc-500">
              总提交
            </div>
          </div>

          <div>
            <div class="text-2xl font-bold">
              {{ user.id }}
            </div>
            <div class="text-xs text-zinc-500">
              UID
            </div>
          </div>

        </div>

      </div>

    </div>

  </div>
</template>
