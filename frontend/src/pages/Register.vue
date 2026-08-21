<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { ref } from 'vue'
import { api } from '@/lib/api'

const router = useRouter()
const username = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('')
const loading = ref(false)
const err = ref('')

async function register() {
  if (!username.value || !email.value || !password.value) { err.value = '请填写所有字段'; return }
  if (password.value.length < 6) { err.value = '密码至少 6 位'; return }
  if (password.value !== confirm.value) { err.value = '两次密码不一致'; return }
  loading.value = true; err.value = ''
  try {
    const res = await api.post<any>('/api/auth/register', { username: username.value, email: email.value, password: password.value })
    localStorage.setItem('etoj_token', res.token)
    localStorage.setItem('etoj_user', JSON.stringify(res.user))
    router.push('/')
  } catch (e: any) { err.value = e.message }
  finally { loading.value = false }
}
</script>

<template>
  <div class="mx-auto max-w-md mt-8 sm:mt-16">
    <div class="card p-6 sm:p-8 space-y-5">
      <div class="text-center space-y-1">
        <div class="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white font-bold text-lg mb-2">E</div>
        <h1 class="text-2xl font-bold">创建账号</h1>
        <p class="text-sm text-zinc-500">加入 ETOJ，开始练习算法</p>
      </div>
      <form @submit.prevent="register" class="space-y-4">
        <div>
          <label class="text-sm font-medium text-zinc-700 mb-1 block">用户名</label>
          <input v-model="username" autocomplete="username" class="input" placeholder="输入用户名" />
        </div>
        <div>
          <label class="text-sm font-medium text-zinc-700 mb-1 block">邮箱</label>
          <input v-model="email" type="email" autocomplete="email" class="input" placeholder="you@example.com" />
        </div>
        <div>
          <label class="text-sm font-medium text-zinc-700 mb-1 block">密码</label>
          <input v-model="password" type="password" autocomplete="new-password" class="input" placeholder="至少 6 位" />
        </div>
        <div>
          <label class="text-sm font-medium text-zinc-700 mb-1 block">确认密码</label>
          <input v-model="confirm" type="password" autocomplete="new-password" class="input" placeholder="再次输入密码" />
        </div>
        <div v-if="err" class="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{{ err }}</div>
        <button type="submit" :disabled="loading" class="btn-primary w-full py-2.5">
          {{ loading ? '注册中...' : '注册' }}
        </button>
      </form>
      <div class="text-sm text-center text-zinc-500">
        已有账号？<RouterLink to="/login" class="link font-medium">立即登录</RouterLink>
      </div>
    </div>
  </div>
</template>
