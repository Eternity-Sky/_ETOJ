<template>
  <div class="solution-comments mt-6">
    <h4 class="text-md font-semibold mb-4">Comments ({{ comments.length }})</h4>
    
    <!-- Comment form -->
    <div class="mb-4">
      <textarea
        v-model="newComment"
        class="w-full border border-zinc-300 rounded-md p-3 text-sm focus:outline-none focus:border-blue-500 resize-none"
        rows="3"
        :placeholder="replyingTo ? `Replying to ${replyingTo.username}...` : 'Write a comment... (Markdown & LaTeX supported)'"
      ></textarea>
      <div class="flex gap-2 mt-2">
        <button 
          @click="submitComment"
          :disabled="!newComment.trim() || submitting"
          class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors disabled:opacity-50"
        >
          {{ submitting ? 'Posting...' : (replyingTo ? 'Reply' : 'Post Comment') }}
        </button>
        <button 
          v-if="replyingTo"
          @click="cancelReply"
          class="border border-zinc-300 text-zinc-700 px-4 py-2 rounded-md text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
    
    <!-- Comments list -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="w-6 h-6 border-4 border-zinc-200 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
    
    <div v-else-if="comments.length === 0" class="text-center py-8 text-zinc-500 text-sm">
      No comments yet. Be the first to comment!
    </div>
    
    <div v-else class="space-y-4">
      <div 
        v-for="comment in topLevelComments" 
        :key="comment.id"
        class="border border-zinc-200 rounded-md p-4 bg-zinc-50"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="font-medium text-sm">{{ comment.username }}</span>
            <span class="text-xs text-zinc-500">{{ new Date(comment.created_at).toLocaleString() }}</span>
          </div>
          <div class="flex gap-2">
            <button 
              @click="startReply(comment)"
              class="text-xs text-blue-500 hover:text-blue-600"
            >
              Reply
            </button>
            <button 
              v-if="comment.user_id === currentUserId"
              @click="deleteComment(comment.id)"
              class="text-xs text-red-500 hover:text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
        <div class="text-sm text-zinc-700">
          <MarkdownRenderer :content="comment.content" />
        </div>
        
        <!-- Replies -->
        <div v-if="getReplies(comment.id).length > 0" class="mt-4 pl-4 border-l-2 border-zinc-200 space-y-3">
          <div 
            v-for="reply in getReplies(comment.id)" 
            :key="reply.id"
            class="border border-zinc-200 rounded-md p-3 bg-white"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm">{{ reply.username }}</span>
                <span class="text-xs text-zinc-500">{{ new Date(reply.created_at).toLocaleString() }}</span>
              </div>
              <button 
                v-if="reply.user_id === currentUserId"
                @click="deleteComment(reply.id)"
                class="text-xs text-red-500 hover:text-red-600"
              >
                Delete
              </button>
            </div>
            <div class="text-sm text-zinc-700">
              <MarkdownRenderer :content="reply.content" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { api } from '@/lib/api'
import MarkdownRenderer from './MarkdownRenderer.vue'

const props = defineProps<{
  solutionId: number
  currentUserId?: number
}>()

const comments = ref<any[]>([])
const newComment = ref('')
const submitting = ref(false)
const loading = ref(false)
const replyingTo = ref<any>(null)

const topLevelComments = computed(() => {
  return comments.value.filter(c => !c.parent_id)
})

function getReplies(parentId: number) {
  return comments.value.filter(c => c.parent_id === parentId)
}

function startReply(comment: any) {
  replyingTo.value = comment
  newComment.value = ''
}

function cancelReply() {
  replyingTo.value = null
  newComment.value = ''
}

async function loadComments() {
  loading.value = true
  try {
    const data = await api.get(`/api/solutions/${props.solutionId}/comments`)
    comments.value = data.comments || []
  } catch (e: any) {
    console.error('Failed to load comments:', e)
  } finally {
    loading.value = false
  }
}

async function submitComment() {
  if (!newComment.value.trim()) return
  
  submitting.value = true
  try {
    await api.post(`/api/solutions/${props.solutionId}/comments`, {
      content: newComment.value,
      parentId: replyingTo.value ? replyingTo.value.id : null
    })
    newComment.value = ''
    replyingTo.value = null
    await loadComments()
  } catch (e: any) {
    console.error('Failed to post comment:', e)
    alert('Failed to post comment: ' + e.message)
  } finally {
    submitting.value = false
  }
}

async function deleteComment(commentId: number) {
  if (!confirm('确定要删除这条评论吗？')) return
  
  try {
    await api.del(`/api/solutions/${props.solutionId}/comments/${commentId}`)
    await loadComments()
  } catch (e: any) {
    console.error('Failed to delete comment:', e)
    alert('Failed to delete comment: ' + e.message)
  }
}

onMounted(loadComments)
</script>

<style scoped>
.solution-comments {
  border-top: 1px solid #e5e7eb;
  padding-top: 1.5rem;
}
</style>
