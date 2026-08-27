<script setup lang="ts">
import { computed } from "vue"
import { RouterLink } from "vue-router"

const props = withDefaults(
  defineProps<{
    id?: number | string | null
    userId?: number | string | null
    uid?: number | string | null
    username?: string | null
    avatarUrl?: string | null
    size?: "sm" | "md" | "lg"
  }>(),
  {
    id: null,
    userId: null,
    uid: null,
    username: "",
    avatarUrl: "",
    size: "md",
  }
)

const resolvedId = computed(() => {
  return props.id ?? props.userId ?? props.uid ?? null
})

const avatarSize = computed(() => {
  if (props.size === "sm") return "h-6 w-6"
  if (props.size === "lg") return "h-12 w-12"
  return "h-8 w-8"
})

const textSize = computed(() => {
  if (props.size === "sm") return "text-xs"
  if (props.size === "lg") return "text-base"
  return "text-sm"
})

const initial = computed(() => {
  return props.username?.trim()?.[0]?.toUpperCase() || "?"
})
</script>

<template>
  <!-- 有 UID 才允许跳转 -->
  <RouterLink
    v-if="resolvedId !== null && resolvedId !== undefined"
    :to="`/users/${resolvedId}`"
    class="inline-flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
  >
    <img
      v-if="avatarUrl"
      :src="avatarUrl"
      :alt="`${username} 的头像`"
      :class="[
        avatarSize,
        'rounded-full object-cover shrink-0 bg-zinc-800'
      ]"
      loading="lazy"
      @error="($event.target as HTMLImageElement).style.display = 'none'"
    />

    <span
      v-else
      :class="[
        avatarSize,
        'inline-flex items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold shrink-0'
      ]"
    >
      {{ initial }}
    </span>

    <span
      :class="[
        textSize,
        'font-medium truncate text-zinc-700 dark:text-zinc-200'
      ]"
    >
      {{ username || "未知用户" }}
    </span>
  </RouterLink>

  <!-- 没有 UID 时不要生成 /undefined -->
  <span
    v-else
    class="inline-flex items-center gap-2 min-w-0"
  >
    <span
      :class="[
        avatarSize,
        'inline-flex items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 font-bold shrink-0'
      ]"
    >
      {{ initial }}
    </span>

    <span
      :class="[
        textSize,
        'font-medium truncate text-zinc-500'
      ]"
    >
      {{ username || "未知用户" }}
    </span>
  </span>
</template>
