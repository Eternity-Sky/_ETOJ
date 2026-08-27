<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { ref } from 'vue'
import { api } from '@/lib/api'
import Captcha from '@/components/Captcha.vue'

const router = useRouter()
const username = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('')
const loading = ref(false)
const err = ref('')
const captchaInput = ref('')
const captchaId = ref('')
const captchaCode = ref('')

async function getCaptcha() {
  try {
    const response = await api.get('/api/captcha')
    captchaId.value = response.captchaId
    captchaCode.value = response.captchaCode
    captchaInput.value = '' // 刷新时清空输入
    console.log('验证码已刷新，ID:', response.captchaId)
  } catch (e: any) {
    console.error('Failed to get captcha:', e)
  }
}

async function register() {
  if (!username.value || !email.value || !password.value) { err.value = '请填写所有字段'; return }
  if (password.value.length < 6) { err.value = '密码至少 6 位'; return }
  if (password.value !== confirm.value) { err.value = '两次密码不一致'; return }
  if (!captchaInput.value.trim()) { err.value = '请输入验证码'; return }
  loading.value = true; err.value = ''
  try {
    const res = await api.post<any>('/api/auth/register', { 
      username: username.value, 
      email: email.value, 
      password: password.value,
      captchaId: captchaId.value,
      captchaCode: captchaInput.value
    })
    localStorage.setItem('etoj_token', res.token)
    localStorage.setItem('etoj_user', JSON.stringify(res.user))
    router.push('/')
  } catch (e: any) { 
    err.value = e.message
    await getCaptcha()
    captchaInput.value = ''
  } finally { loading.value = false }
}

getCaptcha()
</script>

<template>
  <div class="mx-auto max-w-md mt-8 sm:mt-16">
    <div class="bg-zinc-800 border border-zinc-700 p-6 sm:p-8 space-y-5">
      <div class="text-center space-y-1">
        <div class="inline-flex h-11 w-11 items-center justify-center bg-blue-600 text-white font-bold text-lg mb-2">E</div>
        <h1 class="text-2xl font-bold text-zinc-100">创建账号</h1>
        <p class="text-sm text-zinc-400">加入 ETOJ，开始练习算法</p>
      </div>
      <form @submit.prevent="register" class="space-y-4">
        <div>
          <label class="text-sm font-medium text-zinc-300 mb-1 block">用户名</label>
          <input v-model="username" autocomplete="username" class="w-full bg-zinc-900 text-zinc-100 border border-zinc-600 px-3 py-2 focus:outline-none focus:border-blue-500" placeholder="输入用户名" />
        </div>
        <div>
          <label class="text-sm font-medium text-zinc-300 mb-1 block">邮箱</label>
          <input v-model="email" type="email" autocomplete="email" class="w-full bg-zinc-900 text-zinc-100 border border-zinc-600 px-3 py-2 focus:outline-none focus:border-blue-500" placeholder="you@example.com" />
        </div>
        <div>
          <label class="text-sm font-medium text-zinc-300 mb-1 block">密码</label>
          <input v-model="password" type="password" autocomplete="new-password" class="w-full bg-zinc-900 text-zinc-100 border border-zinc-600 px-3 py-2 focus:outline-none focus:border-blue-500" placeholder="至少 6 位" />
        </div>
        <div>
          <label class="text-sm font-medium text-zinc-300 mb-1 block">确认密码</label>
          <input v-model="confirm" type="password" autocomplete="new-password" class="w-full bg-zinc-900 text-zinc-100 border border-zinc-600 px-3 py-2 focus:outline-none focus:border-blue-500" placeholder="再次输入密码" />
        </div>
        <Captcha 
          v-model="captchaInput" 
          :captcha-code="captchaCode"
          @refresh="getCaptcha"
        />
        <div v-if="err" class="text-sm text-rose-400 bg-rose-900/30 border border-rose-800 px-3 py-2">{{ err }}</div>
        <button type="submit" :disabled="loading" class="w-full bg-blue-600 text-white py-2.5 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {{ loading ? '注册中...' : '注册' }}
        </button>
      </form>
      <div class="text-sm text-center text-zinc-400">
        已有账号？<RouterLink to="/login" class="text-blue-400 hover:text-blue-300 font-medium">立即登录</RouterLink>
      </div>
    </div>
  </div>
</template>