<script setup lang="ts">
import Toast from './Toast.vue'
import { useToast } from '@/lib/toast'

const { toasts, removeToast } = useToast()
</script>

<template>
  <div class="fixed top-0 left-0 right-0 z-50 pointer-events-none">
    <div class="flex flex-col items-center gap-2 pt-4">
      <Toast
        v-for="toast in toasts"
        :key="toast.id"
        :message="toast.message"
        :type="toast.type"
        :duration="toast.duration"
        @close="removeToast(toast.id)"
      />
    </div>
  </div>
</template>