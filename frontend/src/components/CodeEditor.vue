<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { cpp } from '@codemirror/lang-cpp'
import { python } from '@codemirror/lang-python'
import { java } from '@codemirror/lang-java'
import { oneDark } from '@codemirror/theme-one-dark'

const props = defineProps<{
  modelValue: string
  language: string
  height?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorContainer = ref<HTMLElement>()
let view: EditorView | null = null

const languageExtensions: Record<string, any> = {
  javascript: javascript(),
  cpp: cpp(),
  python: python(),
  pypy3: python(),
  java8: java(),
  // 可以添加更多语言支持
}

async function initEditor() {
  if (!editorContainer.value) return
  
  const extensions = [
    basicSetup,
    oneDark,
    EditorView.theme({
      '&': {
        height: props.height || '500px'
      }
    })
  ]
  
  // 根据语言添加对应的支持
  const langExt = languageExtensions[props.language]
  if (langExt) {
    extensions.push(langExt)
  }
  
  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      ...extensions,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          emit('update:modelValue', view?.state.doc.toString() || '')
        }
      })
    ]
  })
  
  view = new EditorView({
    state,
    parent: editorContainer.value
  })
}

function updateValue() {
  if (view && view.state.doc.toString() !== props.modelValue) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: props.modelValue }
    })
  }
}

onMounted(() => {
  initEditor()
})

onBeforeUnmount(() => {
  if (view) {
    view.destroy()
    view = null
  }
})

watch(() => props.modelValue, updateValue)
</script>

<template>
  <div 
    ref="editorContainer" 
    class="code-editor-container"
  ></div>
</template>

<style scoped>
.code-editor-container {
  width: 100%;
  border: 1px solid #333;
  border-radius: 4px;
  overflow: hidden;
}
</style>
