<template>
  <div class="solution-comments mt-6">
    <h4 class="text-md font-semibold mb-4">Comments ({{ comments.length }})</h4>
    
    <!-- Comment form -->
    <div class="mb-4">
      <textarea
        v-model="newComment"
        class="w-full border border-zinc-300 rounded-md p-3 text-sm focus:outline-none focus:border-blue-500 resize-none"
        rows="3"
        placeholder="Write a comment... (Markdown & LaTeX supported)"
      ></textarea>
      <button 
        @click="submitComment"
        :disabled="!newComment.trim() || submitting"
        class="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors disabled:opacity-50"
      >
        {{ submitting ? 'Posting...' : 'Post Comment' }}
      </button>
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
        v-for="comment in comments" 
        :key="comment.id"
        class="border border-zinc-200 rounded-md p-4 bg-zinc-50"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="font-medium text-sm">{{ comment.username }}</span>
            <span class="text-xs text-zinc-500">{{ new Date(comment.created_at).toLocaleString() }}</span>
          </div>
          <button 
            v-if="comment.user_id === currentUserId"
            @click="deleteComment(comment.id)"
            class="text-xs text-red-500 hover:text-red-600"
          >
            Delete
          </button>
        </div>
        <div class="text-sm text-zinc-700">
          <MarkdownRenderer :content="comment.content" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
      content: newComment.value
    })
    newComment.value = ''
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
