<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { ref, onMounted } from 'vue'
import { api, type User } from './lib/api'
import ToastContainer from './components/ToastContainer.vue'

const user = ref<User | null>(null)

async function loadMe() {
  if (!localStorage.getItem('etoj_token')) return
  try { user.value = await api.get('/api/auth/me') } catch { logout() }
}

function logout() {
  localStorage.removeItem('etoj_token')
  localStorage.removeItem('etoj_user')
  user.value = null
  location.href = '/login'
}

onMounted(() => {
  const cached = localStorage.getItem('etoj_user')
  if (cached) { try { user.value = JSON.parse(cached) } catch {} }
  loadMe()
})
</script>

<template>
  <div class="min-h-screen bg-zinc-900 text-zinc-100 flex flex-col">
    <ToastContainer />
    <header class="sticky top-0 z-40 border-b border-zinc-700 bg-zinc-800">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <RouterLink to="/" class="flex items-center gap-2 font-bold text-lg tracking-tight">
          <span class="inline-flex h-7 w-7 items-center justify-center bg-zinc-700 text-white text-sm">E</span>
          <span>ETOJ</span>
        </RouterLink>
        <nav class="hidden md:flex items-center gap-1 text-sm">
          <RouterLink to="/problems" class="px-3 py-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100">题目</RouterLink>
          <RouterLink to="/submissions" class="px-3 py-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100">提交</RouterLink>
          <RouterLink to="/rankings" class="px-3 py-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100">排行榜</RouterLink>
          <RouterLink v-if="user && user.username === 'admin'" to="/admin" class="px-3 py-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100">后台</RouterLink>
        </nav>
        <div class="flex items-center gap-2">
          <template v-if="user">
            <RouterLink to="/me" class="text-zinc-300 hover:text-zinc-100 hidden sm:flex items-center gap-2">
              <span class="h-6 w-6 inline-flex items-center justify-center bg-zinc-700 text-zinc-300 text-xs font-bold">{{ user.username[0].toUpperCase() }}</span>
              <span>{{ user.username }}</span>
            </RouterLink>
            <button class="border border-zinc-600 text-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-700 hover:text-zinc-100" @click="logout">退出</button>
          </template>
          <template v-else>
            <RouterLink to="/login" class="text-zinc-300 hover:text-zinc-100 px-3 py-1.5 text-sm hover:bg-zinc-700">登录</RouterLink>
            <RouterLink to="/register" class="bg-zinc-700 text-white px-3 py-1.5 text-sm hover:bg-zinc-600">注册</RouterLink>
          </template>
        </div>
      </div>
    </header>

    <main class="flex-1">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <RouterView v-slot="{ Component }">
          <Component :is="Component" />
        </RouterView>
      </div>
    </main>

    <footer class="border-t border-zinc-700 bg-zinc-800">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 py-6 text-xs text-zinc-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>© {{ new Date().getFullYear() }} ETOJ. 基于 Cloudflare Workers + GitHub Actions 构建。</span>
        <span class="flex items-center gap-4">
          <a href="https://workers.cloudflare.com/" target="_blank" rel="noopener" class="hover:text-zinc-300">Cloudflare Workers</a>
          <a href="https://github.com/features/actions" target="_blank" rel="noopener" class="hover:text-zinc-300">GitHub Actions</a>
        </span>
      </div>
    </footer>
  </div>
</template>
