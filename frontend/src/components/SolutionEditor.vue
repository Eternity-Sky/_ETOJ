<template>
  <div class="solution-editor">
    <div class="mb-4">
      <label class="block text-sm text-zinc-600 mb-1">Solution Title</label>
      <input 
        v-model="title" 
        type="text" 
        class="w-full border border-zinc-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        placeholder="Enter solution title"
      >
    </div>
    
    <div class="mb-4">
      <label class="block text-sm text-zinc-600 mb-1">Content (Markdown + LaTeX supported)</label>
      <div class="border border-zinc-300 rounded-md overflow-hidden">
        <textarea
          v-model="content"
          class="w-full h-64 p-3 text-sm font-mono focus:outline-none resize-none"
          placeholder="Write your solution here..."
        ></textarea>
      </div>
    </div>
    
    <div class="mb-4">
      <button 
        @click="showPreview = !showPreview"
        class="text-sm text-blue-600 hover:text-blue-700"
      >
        {{ showPreview ? 'Hide Preview' : 'Show Preview' }}
      </button>
    </div>
    
    <div v-if="showPreview" class="mb-4 border border-zinc-300 rounded-md p-4 bg-zinc-50">
      <h4 class="text-sm font-medium mb-2">Preview</h4>
      <MarkdownRenderer :content="content" />
    </div>
    
    <div class="flex gap-2">
      <button 
        @click="save" 
        :disabled="loading"
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors disabled:opacity-50"
      >
        {{ loading ? 'Saving...' : 'Save' }}
      </button>
      <button 
        @click="cancel"
        class="border border-zinc-300 hover:border-zinc-400 text-zinc-700 px-4 py-2 rounded-md text-sm transition-colors"
      >
        Cancel
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MarkdownRenderer from './MarkdownRenderer.vue'

const props = defineProps<{
  problemId: number
  existingSolution?: any
}>()

const emit = defineEmits<{
  save: [data: { title: string; content: string }]
  cancel: []
}>()

const title = ref(props.existingSolution?.title || '')
const content = ref(props.existingSolution?.content || '')
const showPreview = ref(false)
const loading = ref(false)

function save() {
  if (!title.value || !content.value) {
    alert('Please fill in both title and content')
    return
  }
  
  loading.value = true
  emit('save', { title: title.value, content: content.value })
  loading.value = false
}

function cancel() {
  emit('cancel')
}
</script>

<style scoped>
.solution-editor {
  background: white;
  padding: 1rem;
  border-radius: 0.5rem;
}
</style>
