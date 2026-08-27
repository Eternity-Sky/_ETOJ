<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { api } from '@/lib/api'
import MarkdownContent from '@/components/MarkdownContent.vue'
import UserLink from '@/components/UserLink.vue'
import { useToast } from '@/lib/toast'

const route = useRoute()
const router = useRouter()
const { success, error: toastError } = useToast()

const discussion = ref<any>(null)
const replies = ref<any[]>([])
const content = ref('')
const loading = ref(true)
const submitting = ref(false)
const currentUser = ref<any>(null)

const editing = ref(false)
const editTitle = ref('')
const editContent = ref('')
const saving = ref(false)

async function loadCurrentUser() {
  try {
    currentUser.value = await api.get("/api/auth/me")
  } catch {
    currentUser.value = null
  }
}

const canEdit = computed(() => {
  if (!currentUser.value || !discussion.value) return false

  return (
    currentUser.value.id === discussion.value.user_id ||
    currentUser.value.role === "admin"
  )
})

const isAdmin = computed(() => {
  return currentUser.value?.role === "admin"
})

async function loadDiscussion() {
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
    await loadDiscussion()
  } catch (e: any) {
    toastError(e?.message || '回复失败')
  } finally {
    submitting.value = false
  }
}

function startEdit() {
  editTitle.value = discussion.value.title
  editContent.value = discussion.value.content
  editing.value = true
}

async function saveEdit() {
  if (!editTitle.value.trim()) {
    toastError("请输入标题")
    return
  }

  if (!editContent.value.trim()) {
    toastError("请输入内容")
    return
  }

  saving.value = true

  try {
    await api.put(
      `/api/discussions/${route.params.id}`,
      {
        title: editTitle.value.trim(),
        content: editContent.value.trim()
      }
    )

    success("帖子编辑成功")

    editing.value = false

    await loadDiscussion()
  } catch (e: any) {
    toastError(e?.message || "编辑失败")
  } finally {
    saving.value = false
  }
}

async function deleteDiscussion() {
  if (!confirm("确定要删除这个帖子吗？删除后无法恢复。")) {
    return
  }

  try {
    await api.delete(
      `/api/discussions/${route.params.id}`
    )

    success("帖子删除成功")

    router.push("/discussions")
  } catch (e: any) {
    toastError(e?.message || "删除失败")
  }
}

async function togglePin() {
  const pinned = !Boolean(discussion.value.is_pinned)

  try {
    await api.patch(
      `/api/discussions/${route.params.id}/pin`,
      {
        pinned
      }
    )

    success(
      pinned
        ? "帖子已置顶"
        : "帖子已取消置顶"
    )

    await loadDiscussion()
  } catch (e: any) {
    toastError(e?.message || "操作失败")
  }
}

onMounted(async () => {
  await loadCurrentUser()
  await loadDiscussion()
})
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
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h1 class="text-2xl font-bold text-zinc-100">
              {{ discussion.title }}
            </h1>

            <div class="mt-3">
              <UserLink
                :user-id="discussion.user_id"
                :username="discussion.username"
                :avatar-url="discussion.avatar_url"
                size="sm"
              />
            </div>
          </div>

          <div
            v-if="canEdit || isAdmin"
            class="flex items-center gap-2 shrink-0"
          >
            <button
              v-if="isAdmin"
              @click="togglePin"
              class="btn-outline"
            >
              {{ discussion.is_pinned ? "取消置顶" : "置顶" }}
            </button>

            <button
              v-if="canEdit"
              @click="startEdit"
              class="btn-outline"
            >
              编辑
            </button>

            <button
              v-if="canEdit"
              @click="deleteDiscussion"
              class="btn-outline text-red-500"
            >
              删除
            </button>
          </div>
        </div>

        <div class="mt-3 text-sm text-zinc-500">
          <span>
            · {{ discussion.created_at }}
            · {{ discussion.views }} 浏览
          </span>
        </div>
      </header>

      <div v-if="editing" class="p-6 space-y-4">
        <input
          v-model="editTitle"
          maxlength="100"
          class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100"
          placeholder="标题"
        />

        <textarea
          v-model="editContent"
          maxlength="20000"
          rows="16"
          class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100"
          placeholder="支持 Markdown 和 LaTeX"
        />

        <div class="flex justify-end gap-3">
          <button
            @click="editing = false"
            class="btn-outline"
          >
            取消
          </button>

          <button
            @click="saveEdit"
            :disabled="saving"
            class="btn-primary"
          >
            {{ saving ? "保存中..." : "保存修改" }}
          </button>
        </div>
      </div>

      <div
        v-else
        class="p-6 text-zinc-200"
      >
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
            <UserLink
              :user-id="reply.user_id"
              :username="reply.username"
              :avatar-url="reply.avatar_url"
              size="sm"
            />

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
