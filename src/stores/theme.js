import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

// 主题管理 store
export const useThemeStore = defineStore('theme', () => {
  // 从 localStorage 读取保存的主题
  const getInitialTheme = () => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) {
      return savedTheme === 'dark'
    }
    // 检测系统主题偏好
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  const isDarkMode = ref(getInitialTheme())

  // 初始化主题
  updateDocumentTheme()

  // 监听系统主题变化
  let mediaQuery = null
  if (typeof window !== 'undefined') {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', handleSystemThemeChange)
  }

  function handleSystemThemeChange(e) {
    // 只在用户没有手动设置过主题时才跟随系统
    if (!localStorage.getItem('theme')) {
      isDarkMode.value = e.matches
    }
  }

  // 切换主题
  function toggleTheme() {
    isDarkMode.value = !isDarkMode.value
    localStorage.setItem('theme', isDarkMode.value ? 'dark' : 'light')
    updateDocumentTheme()
  }

  // 设置主题
  function setTheme(theme) {
    isDarkMode.value = theme === 'dark'
    localStorage.setItem('theme', theme)
    updateDocumentTheme()
  }

  // 更新文档主题类
  function updateDocumentTheme() {
    if (isDarkMode.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // 组件卸载时清理监听器
  function cleanup() {
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }
  }

  return { isDarkMode, toggleTheme, setTheme, cleanup }
})
