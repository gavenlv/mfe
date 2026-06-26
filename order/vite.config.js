/**
 * 文件级注释：vite.config.js
 * 所属微前端：order（订单微前端）
 * 核心职责：配置 Vite 构建工具与 Module Federation（模块联邦）插件，
 *           把 order 微前端打包成一个可被宿主（host）远程加载的 remote。
 * 关键概念：
 *   1. Module Federation（模块联邦）：一种微前端方案，允许多个独立构建在运行时
 *      互相加载彼此的模块。每个微前端既能"暴露(exposes)"自己的组件，
 *      也能"消费(shared)"公共依赖。
 *   2. remote（远程）角色：本文件把 order 配置成一个 remote，
 *      宿主通过加载本微前端的 remoteEntry.js 来获取 ./App 组件（结算、订单列表、订单详情）。
 *   3. shared（共享依赖）：把 react/react-dom/react-router-dom 标记为共享，
 *      运行时优先复用宿主已加载的同一份依赖，避免重复下载、保证单例
 *      （react-router-dom 必须单例，否则路由 context 无法跨微前端共享）。
 *   注：本配置与 auth 微前端的 vite.config.js 结构完全一致，仅 name 与 port 不同，
 *       体现微前端"每个子应用独立配置、独立部署"的解耦特性。
 */
import { defineConfig } from 'vite'; // Vite 配置辅助函数，提供默认合并与类型提示
import react from '@vitejs/plugin-react'; // Vite 的 React 插件，支持 JSX 与 Fast Refresh 热更新
import federation from '@originjs/vite-plugin-federation'; // Vite 版模块联邦插件，让 Vite 项目支持微前端模块共享

export default defineConfig({
  plugins: [
    react(),
    federation({
      // ====== 模块联邦配置开始 ======
      name: 'orderApp', // 当前 remote 的唯一名字，宿主引用时用这个名字标识
      filename: 'remoteEntry.js', // 暴露给宿主的入口文件名，宿主通过它发现并加载本微前端的模块
      exposes: {
        // exposes：声明本微前端要"对外暴露"哪些模块
        // 键 './App' 是对外暴露的访问路径，值是源码中的实际文件
        // 宿主可通过 remote('orderApp@http://.../remoteEntry.js') 然后 import('orderApp/App') 来加载
        './App': './src/App.jsx',
      },
      // shared：把以下依赖标记为共享依赖。
      // 运行时若宿主已经加载过这些库，微前端会复用宿主版本而不是再下载一份，
      // 既减小体积，又保证 React、路由等需要"单例"的库只存在一份实例。
      shared: ['react', 'react-dom', 'react-router-dom'],
    }),
  ],
  build: {
    // target 设为 esnext：模块联邦依赖动态 import 与顶层 await 等现代 JS 特性，
    // 因此编译目标要设到最新标准，不做向下转译。
    target: 'esnext',
    // cssCodeSplit: false：关闭 CSS 拆分，把样式合并到单文件，
    // 方便微前端作为 remote 被加载时样式一并注入。
    cssCodeSplit: false,
  },
  server: {
    port: 5177, // order 微前端独立开发时的本地端口（区别于 auth 的 5176）
    strictPort: true, // 严格端口：若 5177 被占用直接报错退出，避免端口漂移影响宿主配置
  },
});
