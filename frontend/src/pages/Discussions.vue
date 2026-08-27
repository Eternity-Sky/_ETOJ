<script setup lang="ts">
import { ref, onMounted } from "vue"
import { RouterLink } from "vue-router"
import { api } from "@/lib/api"
import UserLink from "@/components/UserLink.vue"

const discussions = ref<any[]>([])
const loading = ref(true)

async function load() {
  loading.value = true

  try {
    const data = await api.get("/api/discussions")
    discussions.value = data.items || []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="max-w-5xl mx-auto">

    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-zinc-100">
          讨论区
        </h1>

        <p class="mt-1 text-sm text-zinc-500">
          分享想法，交流问题
        </p>
      </div>

      <RouterLink
        to="/discussions/new"
        class="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-500"
      >
        发帖
      </RouterLink>
    </div>

    <div v-if="loading" class="py-12 text-center text-zinc-500">
      加载中...
    </div>

    <div
      v-else-if="discussions.length === 0"
      class="border border-zinc-700 rounded-lg py-16 text-center text-zinc-500"
    >
      暂无帖子
    </div>

    <div
      v-else
      class="border border-zinc-700 rounded-lg overflow-hidden"
    >
      <RouterLink
        v-for="item in discussions"
        :key="item.id"
        :to="`/discussion/${item.id}`"
        class="block px-5 py-4 border-b border-zinc-700 last:border-b-0 hover:bg-zinc-800"
      >
        <div class="flex justify-between gap-4">

          <div class="min-w-0">

            <div class="flex items-center gap-2">
              <span
                v-if="item.is_pinned"
                class="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400"
              >
                置顶
              </span>

              <h2 class="text-base font-medium text-zinc-100 truncate">
                {{ item.title }}
              </h2>
            </div>

            <div class="mt-2 text-sm text-zinc-500">
              <UserLink
                :user-id="item.user_id"
                :username="item.username"
                :avatar-url="item.avatar_url"
              />
              · {{ item.reply_count }} 回复
              · {{ item.views }} 浏览
            </div>

          </div>

          <div class="text-xs text-zinc-500 whitespace-nowrap">
            {{ item.updated_at }}
          </div>

        </div>
      </RouterLink>
    </div>

  </div>
</template>
