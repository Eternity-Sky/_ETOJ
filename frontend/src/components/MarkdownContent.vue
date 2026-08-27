<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import DOMPurify from 'dompurify'
import 'katex/dist/katex.min.css'

const props = defineProps<{
  content: string
}>()

marked.use(
  markedKatex({
    throwOnError: false,
    nonStandard: true,
  })
)

marked.setOptions({
  gfm: true,
  breaks: true,
})

const html = computed(() => {
  const rendered = marked.parse(props.content || '') as string

  return DOMPurify.sanitize(rendered, {
    USE_PROFILES: {
      html: true,
    },
  })
})
</script>

<template>
  <div
    class="markdown-body"
    v-html="html"
  />
</template>

<style scoped>
.markdown-body {
  line-height: 1.8;
  overflow-wrap: break-word;
}

.markdown-body :deep(h1) {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 1.5rem 0 1rem;
}

.markdown-body :deep(h2) {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 1.4rem 0 0.8rem;
}

.markdown-body :deep(h3) {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1.2rem 0 0.7rem;
}

.markdown-body :deep(p) {
  margin: 0.8rem 0;
}

.markdown-body :deep(a) {
  color: #60a5fa;
  text-decoration: underline;
}

.markdown-body :deep(ul) {
  list-style: disc;
  margin: 0.8rem 0;
  padding-left: 1.8rem;
}

.markdown-body :deep(ol) {
  list-style: decimal;
  margin: 0.8rem 0;
  padding-left: 1.8rem;
}

.markdown-body :deep(blockquote) {
  margin: 1rem 0;
  padding: 0.5rem 1rem;
  border-left: 4px solid #52525b;
  color: #a1a1aa;
  background: #18181b;
}

.markdown-body :deep(code) {
  background: #27272a;
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
  font-family: monospace;
}

.markdown-body :deep(pre) {
  overflow-x: auto;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  padding: 1rem;
  margin: 1rem 0;
}

.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
}

.markdown-body :deep(hr) {
  border: 0;
  border-top: 1px solid #3f3f46;
  margin: 1.5rem 0;
}

.markdown-body :deep(img) {
  max-width: 100%;
  height: auto;
}

.markdown-body :deep(.katex-display) {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.5rem 0;
}
</style>
