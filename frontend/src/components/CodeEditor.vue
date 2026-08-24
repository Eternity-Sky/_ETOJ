<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, defineAsyncComponent } from 'vue'

const MonacoEditor = defineAsyncComponent(() => 
  import('monaco-editor').then(monaco => {
    return {
      setup() {
        return () => null // 组件实际逻辑在下面
      }
    }
  })
)

const props = defineProps<{
  modelValue: string
  language: string
  height?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorContainer = ref<HTMLElement>()
let editor: any = null
let monaco: any = null

const languageMap: Record<string, string> = {
  c: 'c',
  cpp: 'cpp',
  cpp98: 'cpp',
  cpp11: 'cpp',
  cpp14: 'cpp',
  cpp17: 'cpp',
  cpp20: 'cpp',
  cpp23: 'cpp',
  java: 'java',
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  go: 'go',
  rust: 'rust'
}

async function initEditor() {
  if (!editorContainer.value) return
  
  // 动态导入 Monaco Editor
  const monacoModule = await import('monaco-editor')
  monaco = monacoModule.default || monacoModule
  
  editor = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language: languageMap[props.language] || props.language,
    theme: 'vs-dark',
    fontSize: 14,
    lineNumbers: 'on',
    minimap: { enabled: false }, // 禁用minimap减少性能开销
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 4,
    wordWrap: 'on',
    padding: { top: 16, bottom: 16 },
    renderLineHighlight: 'line',
    cursorBlinking: 'smooth',
    smoothScrolling: true
  })

  editor.onDidChangeModelContent(() => {
    const value = editor?.getValue() || ''
    emit('update:modelValue', value)
  })
}

function updateLanguage() {
  if (editor && monaco) {
    const model = editor.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, languageMap[props.language] || props.language)
    }
  }
}

function updateValue() {
  if (editor && editor.getValue() !== props.modelValue) {
    editor.setValue(props.modelValue)
  }
}

onMounted(() => {
  initEditor()
})

onBeforeUnmount(() => {
  if (editor) {
    editor.dispose()
    editor = null
  }
})

watch(() => props.language, updateLanguage)
watch(() => props.modelValue, updateValue)
</script>

<template>
  <div 
    ref="editorContainer" 
    class="code-editor-container"
    :style="{ height: height || '500px' }"
  ></div>
</template>

<style scoped>
.code-editor-container {
  width: 100%;
  border: none;
  border-radius: 0;
}
</style>
