/**
 * 文件：vite.config.js
 * 所属模块：shell（主应用 / 宿主 host）
 * 核心职责：配置 Vite 构建工具，并接入 Module Federation（模块联邦）插件，
 *           让主应用能够远程加载各个子应用（微前端）暴露出来的组件。
 *
 * 关键概念：
 * 1. Vite 是什么？
 *    Vite 是一个面向现代浏览器的前端构建工具。开发阶段利用浏览器原生 ES Module
 *    实现按需编译、秒级启动；打包阶段基于 Rollup 输出生产产物。
 *    通过 vite.config.js 可以配置插件、构建目标、开发服务器端口等。
 *
 * 2. Module Federation（模块联邦）：
 *    Webpack 5 / Vite 插件提供的能力，允许多个独立构建的应用在运行时互相
 *    加载彼此的模块。本项目中：
 *      - shell 是 host（宿主），通过 remotes 引用其它子应用；
 *      - products/cart/auth/order 各子应用是 remote，通过 exposes 暴露自身组件。
 *    配置项含义：
 *      - name: 当前应用在联邦中的唯一标识；
 *      - remotes: 声明要引用哪些远程应用，及其 remoteEntry.js 地址；
 *      - exposes: （子应用用）声明要对外暴露的模块，host 这里不需要；
 *      - shared: 声明共享依赖，避免 react 等被重复加载多份。
 *
 * 3. remoteEntry.js 是什么？
 *    每个远程应用构建后会生成一个 remoteEntry.js（远程入口清单），
 *    它记录了该应用暴露了哪些模块、依赖了哪些 shared 库。
 *    host 通过加载这个文件，就能按需 import 远程模块。
 */

// defineConfig 提供配置项的 TypeScript 类型提示，让配置写错时有报错提示
import { defineConfig } from 'vite';
// Vite 官方 React 插件：提供 JSX 快速刷新、自动注入 React 运行时等能力
import react from '@vitejs/plugin-react';
// 第三方插件，把 Webpack 的 Module Federation 能力移植到 Vite
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    // 启用 React 支持（JSX 转换、Fast Refresh 热更新）
    react(),
    // 配置模块联邦：这一段是“主应用如何连接子应用”的核心
    federation({
      // 当前应用在联邦中的名字，其它应用引用本应用时会用到
      name: 'shell',
      // remotes：声明主应用要引用哪些远程子应用
      // 键（如 productsApp）是“别名”，代码里用 import('productsApp/App') 来引用；
      // 值是子应用构建产物中 remoteEntry.js 的访问地址。
      // 每个子应用都跑在独立端口上，独立部署、独立开发。
      remotes: {
        productsApp: 'http://localhost:5174/assets/remoteEntry.js',
        cartApp: 'http://localhost:5175/assets/remoteEntry.js',
        authApp: 'http://localhost:5176/assets/remoteEntry.js',
        orderApp: 'http://localhost:5177/assets/remoteEntry.js',
      },
      // shared：把 react、react-dom、react-router-dom 声明为共享依赖。
      // 意义：主应用和所有子应用运行时只会加载“一份”React 实例（单例化），
      // 既减小体积，又保证只有一个 React，避免“多份 React 导致 Hooks 报错 /
      // 上下文丢失”等经典微前端问题。react-router-dom 单例后，子应用还能
      // 复用主应用提供的同一个 BrowserRouter，实现路由统一编排。
      shared: ['react', 'react-dom', 'react-router-dom'],
    }),
  ],
  build: {
    // 构建目标设为 esnext：直接输出最新 ES 语法，交给现代浏览器解析。
    // Module Federation 依赖顶层 await / 动态 import 等现代特性，需用 esnext。
    target: 'esnext',
    // cssCodeSplit: false 表示不拆分 CSS，把样式打包到一起。
    // 远程加载的组件样式有时需要随主应用一起加载，关闭拆分可减少样式丢失问题。
    cssCodeSplit: false,
  },
  server: {
    // 主应用开发服务器端口 5173
    port: 5173,
    // strictPort: true 表示端口被占用时直接报错，不自动换端口。
    // 因为子应用的 remoteEntry 地址是写死的，主应用端口必须稳定。
    strictPort: true,
  },
});
