<script setup lang="ts">
import { RouterLink, useRouter } from "vue-router";
import { ref } from "vue";
import { api } from "@/lib/api";

const router = useRouter();
const username = ref("");
const password = ref("");
const loading = ref(false);
const err = ref("");

async function login() {
  if (!username.value || !password.value) {
    err.value = "请填写用户名和密码";
    return;
  }
  loading.value = true;
  err.value = "";
  try {
    const res = await api.post<any>("/api/auth/login", {
      username: username.value,
      password: password.value,
    });
    localStorage.setItem("etoj_token", res.token);
    localStorage.setItem("etoj_user", JSON.stringify(res.user));
    router.push("/");
  } catch (e: any) {
    err.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-md mt-8 sm:mt-16">
    <div class="card p-6 sm:p-8 space-y-5">
      <div class="text-center space-y-1">
        <div
          class="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white font-bold text-lg mb-2"
        >
          E
        </div>
        <h1 class="text-2xl font-bold">登录 ETOJ</h1>
        <p class="text-sm text-zinc-500">欢迎回来，继续你的刷题之路</p>
      </div>
      <form @submit.prevent="login" class="space-y-4">
        <div>
          <label class="text-sm font-medium text-zinc-700 mb-1 block"
            >用户名 / 邮箱</label
          >
          <input
            v-model="username"
            autocomplete="username"
            class="input"
            placeholder="输入用户名或邮箱"
          />
        </div>
        <div>
          <label class="text-sm font-medium text-zinc-700 mb-1 block"
            >密码</label
          >
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            @keyup.enter="login"
            class="input"
            placeholder="输入密码"
          />
        </div>
        <div
          v-if="err"
          class="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"
        >
          {{ err }}
        </div>
        <button
          type="submit"
          :disabled="loading"
          class="btn-primary w-full py-2.5"
        >
          {{ loading ? "登录中..." : "登录" }}
        </button>
      </form>
      <div class="text-sm text-center text-zinc-500">
        还没有账号？<RouterLink to="/register" class="link font-medium"
          >立即注册</RouterLink
        >
      </div>
    </div>
  </div>
</template>
