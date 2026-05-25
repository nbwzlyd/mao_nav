import { fileURLToPath, URL } from 'node:url'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// 从 .env.local 读取本地环境变量
function loadEnvLocal() {
  const env = {}
  try {
    const content = readFileSync(resolve(__dirname, '.env.local'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx > 0) {
        env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
      }
    }
  } catch (_) {
    // .env.local 不存在则忽略
  }
  return env
}

// 本地 API 中间件插件 — 开发模式接管 /api 路由
function localApiPlugin() {
  return {
    name: 'local-api',
    configureServer(server) {
      const localEnv = loadEnvLocal()
      const adminPassword = localEnv.ADMIN_PASSWORD || ''

      // POST /api/verify
      server.middlewares.use('/api/verify', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          })
          res.end()
          return
        }

        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Method not allowed' }))
          return
        }

        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const body = JSON.parse(Buffer.concat(chunks).toString())
          const { password } = body

          if (!adminPassword) {
            res.writeHead(500, {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            })
            res.end(JSON.stringify({ success: false, error: '服务端未配置管理员密钥（请创建 .env.local 文件）' }))
            return
          }

          if (!password || password !== adminPassword) {
            res.writeHead(401, {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            })
            res.end(JSON.stringify({ success: false, error: '密钥错误，请重新输入' }))
            return
          }

          const hash = createHash('sha256')
            .update(adminPassword + ':mao-nav-auth')
            .digest('hex')

          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          })
          res.end(JSON.stringify({ success: true, token: hash }))
        } catch (error) {
          res.writeHead(500, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          })
          res.end(JSON.stringify({ success: false, error: error.message }))
        }
      })

      // 其他 /api/* 路由返回提示
      server.middlewares.use('/api', (req, res) => {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        })
        res.end(JSON.stringify({ success: false, error: '本地开发模式下此 API 不可用，请部署后使用' }))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    localApiPlugin(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 配置SPA fallback，所有路由都返回index.html
    historyApiFallback: true,
  },
  build: {
    // 构建时也需要考虑路由配置
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router'],
          'admin': ['./src/views/AdminView.vue'],
        },
      },
    },
  },
})
