<script setup lang="ts">
import { computed } from "vue"
import { RouterLink } from "vue-router"

const props = withDefaults(
  defineProps<{
    id: number
    username: string
    avatarUrl?: string | null
    size?: "sm" | "md" | "lg"
  }>(),
  {
    avatarUrl: "",
    size: "md",
  }
)

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

const initial = computed(() =>
  props.username?.trim()?.[0]?.toUpperCase() || "?"
)
</script>

<template>
  <RouterLink
    :to="`/users/${id}`"
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
      {{ username }}
    </span>
  </RouterLink>
</template>
