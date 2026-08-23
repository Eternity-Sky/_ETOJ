import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Monaco editor相关
          if (id.includes('monaco-editor')) {
            return 'monaco-editor'
          }
          // Vue相关
          if (id.includes('vue') || id.includes('vue-router')) {
            return 'vue-vendor'
          }
          // Markdown相关
          if (id.includes('marked') || id.includes('katex')) {
            return 'markdown-vendor'
          }
          // 其他vendor
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        }
      }
    },
    chunkSizeWarningLimit: 2000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
})
