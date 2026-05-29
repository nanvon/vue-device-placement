/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    dts({ include: ['src'], tsconfigPath: './tsconfig.json' }),
  ],
  resolve: {
    alias: {
      // 让 playground 以"接入方"的方式 import 包名，与真实用法一致
      'vue-device-placement': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'VueDevicePlacement',
      formats: ['es', 'umd'],
      fileName: (format) => `vue-device-placement.${format}.js`,
    },
    rollupOptions: {
      // vue 不打进包，由接入方提供（peerDependency）
      external: ['vue'],
      output: {
        // 同时存在具名与默认导出，UMD 下统一按具名处理（消除混用警告）
        exports: 'named',
        globals: { vue: 'Vue' },
        // 把抽离出的样式固定命名为 style.css，对应 exports "./style.css"
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) return 'style.css'
          return assetInfo.name ?? 'assets/[name][extname]'
        },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
