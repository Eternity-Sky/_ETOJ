<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  message: string
  type?: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}>()

const emit = defineEmits<{
  close: []
}>()

const visible = ref(false)
const progress = ref(100)

const typeColors = {
  success: 'bg-emerald-500',
  error: 'bg-rose-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500'
}

const duration = props.duration || 3000

onMounted(() => {
  // 动画进入
  setTimeout(() => {
    visible.value = true
  }, 10)

  // 进度条动画
  const interval = setInterval(() => {
    progress.value -= 100 / (duration / 50)
    if (progress.value <= 0) {
      clearInterval(interval)
      close()
    }
  }, 50)
})

function close() {
  visible.value = false
  setTimeout(() => {
    emit('close')
  }, 300)
}
</script>

<template>
  <Transition
    enter-active-class="transition ease-out duration-300"
    enter-from-class="transform -translate-y-full opacity-0"
    enter-to-class="transform translate-y-0 opacity-100"
    leave-active-class="transition ease-in duration-300"
    leave-from-class="transform translate-y-0 opacity-100"
    leave-to-class="transform -translate-y-full opacity-0"
  >
    <div v-if="visible" class="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div class="bg-white rounded-lg shadow-lg border border-zinc-200 overflow-hidden min-w-[300px] max-w-md">
        <div class="flex items-center gap-3 p-4">
          <div :class="['w-2 h-2 rounded-full', typeColors[type || 'info']]"></div>
          <div class="flex-1 text-sm text-zinc-700">{{ message }}</div>
          <button @click="close" class="text-zinc-400 hover:text-zinc-600">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="h-1 bg-zinc-100">
          <div 
            :class="['h-full transition-all duration-50 ease-linear', typeColors[type || 'info']]" 
            :style="{ width: progress + '%' }"
          ></div>
        </div>
      </div>
    </div>
  </Transition>
</template>