<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  modelValue: string
  captchaCode: string  // 接收后端生成的验证码
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'refresh': []
}>()

const canvasRef = ref<HTMLCanvasElement>()

function generateCaptcha(code: string) {
  if (!canvasRef.value) return
  
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // 背景色 - 深色渐变适配暗色主题
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#27272a')
  gradient.addColorStop(1, '#3f3f46')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  // 绘制验证码字符
  ctx.font = 'bold 24px Arial'
  ctx.textBaseline = 'middle'
  
  for (let i = 0; i < code.length; i++) {
    ctx.save()
    
    // 随机位置
    const x = 20 + i * 30
    const y = 25 + Math.random() * 10 - 5
    
    // 随机旋转
    const angle = (Math.random() - 0.5) * 0.3
    ctx.translate(x, y)
    ctx.rotate(angle)
    
    // 随机颜色 - 亮色系适配暗色背景
    const colors = ['#60a5fa', '#a78bfa', '#34d399', '#f87171', '#fbbf24']
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)]
    
    ctx.fillText(code[i], 0, 0)
    ctx.restore()
  }
  
  // 添加干扰线
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height)
    ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height)
    ctx.strokeStyle = `rgba(255, 255, 255, ${Math.random() * 0.15})`
    ctx.lineWidth = 1
    ctx.stroke()
  }
  
  // 添加干扰点
  for (let i = 0; i < 30; i++) {
    ctx.beginPath()
    ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 1, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.2})`
    ctx.fill()
  }
}

function refresh() {
  emit('refresh')
}

// 监听captchaCode变化，重新绘制
import { watch } from 'vue'
watch(() => props.captchaCode, (newCode) => {
  if (newCode) {
    generateCaptcha(newCode)
  }
})

onMounted(() => {
  if (props.captchaCode) {
    generateCaptcha(props.captchaCode)
  }
})

defineExpose({
  refresh
})
</script>

<template>
  <div class="captcha-container">
    <div class="captcha-wrapper">
      <canvas 
        ref="canvasRef" 
        width="140" 
        height="50"
        class="captcha-canvas"
      />
      <button 
        @click="refresh" 
        class="refresh-btn"
        title="刷新验证码"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
          <path d="M16 21h5v-5"/>
        </svg>
      </button>
    </div>
    <input
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      type="text"
      placeholder="输入验证码"
      class="captcha-input"
      maxlength="4"
    />
  </div>
</template>

<style scoped>
.captcha-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.captcha-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.captcha-canvas {
  border-radius: 0.375rem;
  border: 1px solid #3f3f46;
  cursor: pointer;
  transition: all 0.2s ease;
}

.captcha-canvas:hover {
  border-color: #52525b;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 0.375rem;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover {
  background: #3f3f46;
  color: #fafafa;
  transform: rotate(180deg);
}

.refresh-btn:active {
  transform: rotate(180deg) scale(0.95);
}

.captcha-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 0.375rem;
  color: #fafafa;
  font-size: 0.875rem;
  outline: none;
  transition: all 0.2s ease;
}

.captcha-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.captcha-input::placeholder {
  color: #71717a;
}
</style>
