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

  // 保护LaTeX公式，临时替换为占位符
  const mathPlaceholders: { latex: string; type: 'block' | 'inline' }[] = []
  
  // 先保护代码块中的内容，避免代码块中的$被误匹配
  const codeBlocks: string[] = []
  content = content.replace(/```[\s\S]*?```/g, (match: string) => {
    const index = codeBlocks.length
    codeBlocks.push(match)
    return `CODEBLOCK${index}PLACEHOLDER`
  })
  
  // 保护行内代码 `...` 中的内容
  const inlineCodes: string[] = []
  content = content.replace(/`[^`]+`/g, (match: string) => {
    const index = inlineCodes.length
    inlineCodes.push(match)
    return `INLINECODE${index}PLACEHOLDER`
  })
  
  // 保护块级公式 $$...$$
  content = content.replace(/\$\$([\s\S]*?)\$\$/g, (match: string, latex: string) => {
    const index = mathPlaceholders.length
    mathPlaceholders.push({ latex: latex.trim(), type: 'block' })
    return `MATHBLOCK${index}PLACEHOLDER`
  })
  
  // 保护行内公式 $...$（使用更精确的匹配，避免匹配单个$符号）
  content = content.replace(/\$([^$\n]+?)\$/g, (match: string, latex: string) => {
    // 确保不是价格符号等普通$符号
    if (latex.trim().length === 0 || /^[0-9,.]+$/.test(latex.trim())) {
      return match // 如果是纯数字或空，不作为公式处理
    }
    const index = mathPlaceholders.length
    mathPlaceholders.push({ latex: latex.trim(), type: 'inline' })
    return `MATHINLINE${index}PLACEHOLDER`
  })

  // 渲染Markdown
  let html = await marked(content)
  
  // 恢复代码块
  for (let i = 0; i < codeBlocks.length; i++) {
    html = html.replace(new RegExp(`CODEBLOCK${i}PLACEHOLDER`, 'g'), codeBlocks[i])
  }
  
  // 恢复行内代码
  for (let i = 0; i < inlineCodes.length; i++) {
    html = html.replace(new RegExp(`INLINECODE${i}PLACEHOLDER`, 'g'), inlineCodes[i])
  }
  
  // 恢复并渲染LaTeX公式
  for (let i = 0; i < mathPlaceholders.length; i++) {
    const placeholder = mathPlaceholders[i]
    const blockPattern = `MATHBLOCK${i}PLACEHOLDER`
    const inlinePattern = `MATHINLINE${i}PLACEHOLDER`
    
    if (placeholder.type === 'block') {
      html = html.replace(new RegExp(blockPattern, 'g'), () => {
        try {
          return katex.renderToString(placeholder.latex, { 
            displayMode: true,
            throwOnError: false
          })
        } catch (e) {
          console.error('KaTeX render error:', e)
          return `$$${placeholder.latex}$$`
        }
      })
    } else {
      html = html.replace(new RegExp(inlinePattern, 'g'), () => {
        try {
          return katex.renderToString(placeholder.latex, { 
            displayMode: false,
            throwOnError: false
          })
        } catch (e) {
          console.error('KaTeX render error:', e)
          return `$${placeholder.latex}$`
        }
      })
    }
  }
  
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