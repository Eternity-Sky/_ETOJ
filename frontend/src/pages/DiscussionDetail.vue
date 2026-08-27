<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { api } from '@/lib/api'
import MarkdownContent from '@/components/MarkdownContent.vue'
import { useToast } from '@/lib/toast'

const route = useRoute()
const { success, error: toastError } = useToast()

const discussion = ref<any>(null)
const replies = ref<any[]>([])
const content = ref('')
const loading = ref(true)
const submitting = ref(false)

async function load() {
  const data = await api.get(
    `/api/discussions/${route.params.id}` 
  )

  discussion.value = data.discussion
  replies.value = data.replies || []
  loading.value = false
}

async function reply() {
  if (!content.value.trim()) {
    toastError('请输入回复内容')
    return
  }

  submitting.value = true

  try {
    await api.post(
      `/api/discussions/${route.params.id}/replies`,
      {
        content: content.value.trim()
      }
    )

    content.value = ''
    success('回复成功')
    await load()
  } catch (e: any) {
    toastError(e?.message || '回复失败')
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div v-if="loading" class="text-zinc-400">
    加载中...
  </div>

  <div v-else-if="discussion" class="max-w-5xl mx-auto">
    <div class="mb-5 text-sm text-zinc-500">
      <RouterLink
        to="/discussions"
        class="hover:text-zinc-300"
      >
        讨论区
      </RouterLink>
    </div>

    <!-- 帖子 -->
    <article class="border border-zinc-700 rounded-lg overflow-hidden">
      <header class="bg-zinc-800 p-5 border-b border-zinc-700">
        <h1 class="text-2xl font-bold">
          {{ discussion.title }}
        </h1>

        <div class="mt-3 text-sm text-zinc-500">
          {{ discussion.username }}
          · {{ discussion.created_at }}
          · {{ discussion.views }} 浏览
        </div>
      </header>

      <div class="p-6 text-zinc-200">
        <MarkdownContent :content="discussion.content" />
      </div>
    </article>

    <!-- 回复 -->
    <div class="mt-8">
      <h2 class="text-lg font-semibold mb-4">
        {{ replies.length }} 条回复
      </h2>

      <div class="space-y-3">
        <article
          v-for="(reply, index) in replies"
          :key="reply.id"
          class="border border-zinc-700 rounded-lg overflow-hidden"
        >
          <header class="bg-zinc-800 px-4 py-3 flex justify-between">
            <span class="font-medium">
              {{ reply.username }}
            </span>

            <span class="text-sm text-zinc-500">
              #{{ index + 1 }}
              · {{ reply.created_at }}
            </span>
          </header>

          <div class="p-4 text-zinc-300">
            <MarkdownContent :content="reply.content" />
          </div>
        </article>
      </div>
    </div>

    <!-- 回复框 -->
    <div class="mt-6 border border-zinc-700 rounded-lg p-4">
      <textarea
        v-model="content"
        rows="8"
        maxlength="10000"
        placeholder="写下你的回复，支持 Markdown 和 LaTeX，例如 $x^2$..."
        class="w-full rounded-md border border-zinc-700 bg-zinc-900 p-3 text-zinc-100 outline-none focus:border-zinc-500"
      />

      <div class="mt-3 flex justify-end">
        <button
          :disabled="submitting"
          @click="reply"
          class="bg-zinc-100 text-zinc-900 px-5 py-2 rounded-md text-sm font-medium disabled:opacity-50"
        >
          {{ submitting ? '发送中...' : '回复' }}
        </button>
      </div>
    </div>
  </div>
</template>
