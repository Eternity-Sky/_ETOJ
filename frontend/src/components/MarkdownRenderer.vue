<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { marked } from 'marked'
import katex from 'katex'

const props = defineProps<{
  content: string
}>()

const renderedHtml = ref('')

async function renderMarkdown() {
  if (!props.content) {
    renderedHtml.value = ''
    return
  }

  let content = props.content

  // 先用marked渲染Markdown
  let html = await marked(content)

  // 然后渲染LaTeX公式
  // 渲染块级公式 $$...$$
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match: string, latex: string) => {
    try {
      return katex.renderToString(latex.trim(), { 
        displayMode: true,
        throwOnError: false
      })
    } catch (e) {
      console.error('KaTeX render error:', e)
      return match
    }
  })

  // 渲染行内公式 $...$ (使用更严格的匹配)
  html = html.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (match: string, latex: string) => {
    try {
      return katex.renderToString(latex.trim(), { 
        displayMode: false,
        throwOnError: false
      })
    } catch (e) {
      console.error('KaTeX render error:', e)
      return match
    }
  })

  renderedHtml.value = html
}

onMounted(() => renderMarkdown())
watch(() => props.content, () => renderMarkdown())
</script>

<template>
  <div class="markdown-content" v-html="renderedHtml"></div>
</template>

<style>
.markdown-content {
  line-height: 1.6;
  color: #d4d4d8;
}

.markdown-content h1,
.markdown-content h2,
.markdown-content h3,
.markdown-content h4,
.markdown-content h5,
.markdown-content h6 {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
  color: #fafafa;
}

.markdown-content h1 { font-size: 1.875em; }
.markdown-content h2 { font-size: 1.5em; }
.markdown-content h3 { font-size: 1.25em; }

.markdown-content p {
  margin-bottom: 1em;
}

.markdown-content code {
  background-color: #3f3f46;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-family: monospace;
  font-size: 0.875em;
  color: #a1a1aa;
}

.markdown-content pre {
  background-color: #18181b;
  color: #fafafa;
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-bottom: 1em;
  border: 1px solid #3f3f46;
}

.markdown-content pre code {
  background-color: transparent;
  padding: 0;
  color: inherit;
}

.markdown-content ul,
.markdown-content ol {
  margin-left: 1.5em;
  margin-bottom: 1em;
}

.markdown-content li {
  margin-bottom: 0.25em;
}

.markdown-content blockquote {
  border-left: 4px solid #52525b;
  padding-left: 1rem;
  margin-left: 0;
  color: #a1a1aa;
  margin-bottom: 1em;
}

.markdown-content table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1em;
}

.markdown-content th,
.markdown-content td {
  border: 1px solid #3f3f46;
  padding: 0.5rem;
  text-align: left;
}

.markdown-content th {
  background-color: #27272a;
  font-weight: 600;
  color: #fafafa;
}

.markdown-content img {
  max-width: 100%;
  height: auto;
}

.markdown-content hr {
  border: none;
  border-top: 1px solid #3f3f46;
  margin: 1.5em 0;
}
</style>