<script setup lang="ts">
import { ref } from "vue"
import { useRouter } from "vue-router"
import { api } from "@/lib/api"
import MarkdownContent from '@/components/MarkdownContent.vue'
import { useToast } from '@/lib/toast'

const router = useRouter()
const { success, error: toastError } = useToast()

const title = ref("")
const content = ref("")
const submitting = ref(false)
const preview = ref(false)

async function submit() {
  if (!title.value.trim()) {
    toastError('请输入标题')
    return
  }

  if (!content.value.trim()) {
    toastError('请输入内容')
    return
  }

  submitting.value = true

  try {
    const result = await api.post("/api/discussions", {
      title: title.value.trim(),
      content: content.value.trim()
    })

    success('帖子发布成功')

    router.push(`/discussion/${result.id}`)
  } catch (e: any) {
    toastError(e?.message || '帖子发布失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto">

    <div class="mb-6">
      <h1 class="text-2xl font-bold text-zinc-100">
        发布帖子
      </h1>

      <p class="mt-1 text-sm text-zinc-500">
        发布你的问题、想法或讨论
      </p>
    </div>

    <div class="border border-zinc-700 rounded-lg p-5">

      <div class="mb-5">
        <label class="block text-sm text-zinc-300 mb-2">
          标题
        </label>

        <input
          v-model="title"
          maxlength="100"
          placeholder="请输入帖子标题"
          class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none focus:border-blue-500"
        />
      </div>

      <div class="mb-5">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm text-zinc-300">
            内容
          </label>

          <button
            type="button"
            @click="preview = !preview"
            class="text-sm text-blue-400 hover:text-blue-300"
          >
            {{ preview ? '编辑' : '预览' }}
          </button>
        </div>

        <textarea
          v-if="!preview"
          v-model="content"
          maxlength="20000"
          rows="14"
          placeholder="支持 Markdown 和 LaTeX，例如 $x^2$ 或 $$\sum_{i=1}^n i$$"
          class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none focus:border-blue-500"
        />

        <div
          v-else
          class="min-h-[336px] rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-200"
        >
          <MarkdownContent
            v-if="content.trim()"
            :content="content"
          />

          <div
            v-else
            class="text-zinc-500"
          >
            暂无内容
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-3">

        <button
          @click="router.back()"
          class="px-4 py-2 rounded-md border border-zinc-700 text-zinc-300"
        >
          取消
        </button>

        <button
          :disabled="submitting"
          @click="submit"
          class="px-5 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
        >
          {{ submitting ? "发布中..." : "发布帖子" }}
        </button>

      </div>

    </div>

  </div>
</template>
