<template>
  <div class="relative">
    <button @click="toggleDropdown" class="relative p-2 text-gray-600 hover:text-gray-900">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      <span v-if="unreadCount > 0" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
        {{ unreadCount > 9 ? '9+' : unreadCount }}
      </span>
    </button>

    <div v-if="isOpen" class="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
      <div class="p-4 border-b flex justify-between items-center">
        <h3 class="font-semibold">Notifications</h3>
        <button v-if="unreadCount > 0" @click="markAllRead" class="text-sm text-blue-600 hover:text-blue-800">
          Mark all as read
        </button>
      </div>
      <div class="max-h-96 overflow-y-auto">
        <div v-if="notifications.length === 0" class="p-4 text-gray-500 text-center">
          No notifications
        </div>
        <div v-else>
          <div
            v-for="notification in notifications"
            :key="notification.id"
            @click="markAsRead(notification.id)"
            :class="[
              'p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors',
              notification.read === 0 ? 'bg-blue-50' : ''
            ]"
          >
            <div class="flex items-start">
              <div class="flex-shrink-0 mr-3">
                <div
                  :class="[
                    'w-2 h-2 rounded-full mt-2',
                    notification.type === 'success' ? 'bg-green-500' :
                    notification.type === 'error' ? 'bg-red-500' :
                    notification.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                  ]"
                />
              </div>
              <div class="flex-1">
                <h4 class="font-medium text-sm">{{ notification.title }}</h4>
                <p class="text-sm text-gray-600 mt-1">{{ notification.message }}</p>
                <p class="text-xs text-gray-400 mt-2">{{ formatDate(notification.created_at) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api, type Notification } from '../lib/api'

const isOpen = ref(false)
const notifications = ref<Notification[]>([])
const unreadCount = ref(0)

function toggleDropdown() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    loadNotifications()
  }
}

async function loadNotifications() {
  try {
    const data = await api.getNotifications()
    notifications.value = data.notifications
    unreadCount.value = data.unreadCount
  } catch (e: any) {
    console.error('Failed to load notifications:', e)
  }
}

async function markAsRead(id: number) {
  try {
    await api.markNotificationRead(id)
    const notification = notifications.value.find(n => n.id === id)
    if (notification) {
      notification.read = 1
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
  } catch (e: any) {
    console.error('Failed to mark as read:', e)
  }
}

async function markAllRead() {
  try {
    await api.markAllNotificationsRead()
    notifications.value.forEach(n => n.read = 1)
    unreadCount.value = 0
  } catch (e: any) {
    console.error('Failed to mark all as read:', e)
  }
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

onMounted(() => {
  loadNotifications()
  // Poll for new notifications every 30 seconds
  setInterval(loadNotifications, 30000)
})
</script>
