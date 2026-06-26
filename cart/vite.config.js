/**
 * 文件：vite.config.js
 * 所属微前端：cart（购物车微前端）
 * 核心职责：配置 Vite 构建工具，并通过 Module Federation（模块联邦）
 *           把本微前端的 App 组件“暴露”出去，供宿主（host）远程加载。
 *
 * 关键概念——Module Federation（模块联邦）：
 *  - 本微前端作为 remote（被加载方），打包出 remoteEntry.js 供宿主引用。
 *  - exposes：对外暴露 './App'（指向 ./src/App.jsx），宿主可写
 *    import('cartApp/App') 来加载本微前端的根组件。
 *  - shared：把 react、react-dom、react-router-dom 标记为共享依赖，
 *    运行时与宿主共用同一份，避免多份 React 实例导致 hooks/context 问题。
 *  - 与 products 微前端的 vite.config.js 结构完全一致，只是 name/port 不同，
 *    体现微前端的“同构”配置思路。
 */

// defineConfig：Vite 的配置辅助函数，提供类型提示，不影响运行
import { defineConfig } from 'vite';
// @vitejs/plugin-react：Vite 官方 React 插件，提供 JSX 编译与 Fast Refresh
import react from '@vitejs/plugin-react';
// @originjs/vite-plugin-federation：Vite 版模块联邦插件
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    // React 插件：编译 JSX、提供热更新
    react(),
    // 模块联邦配置：本微前端作为 remote 被宿主加载
    federation({
      // name：本微前端唯一标识，宿主引用时用 cartApp/App
      name: 'cartApp',
      // filename：构建产出的远程入口文件名，宿主加载它来获取本微前端模块
      filename: 'remoteEntry.js',
      // exposes：对外暴露的模块。
      // key './App' 是外部引用路径，value './src/App.jsx' 是本项目源文件。
      exposes: {
        './App': './src/App.jsx',
      },
      // shared：共享依赖。宿主和所有微前端共用同一份这些库，
      // 避免重复加载、避免多份 React 实例造成的 hooks/context 问题。
      shared: ['react', 'react-dom', 'react-router-dom'],
    }),
  ],
  // build 配置：
  // - target: 'esnext'：构建目标设为最新 JS，模块联邦依赖动态 import
  // - cssCodeSplit: false：关闭 CSS 拆分，保证样式打包进远程入口便于共享
  build: {
    target: 'esnext',
    cssCodeSplit: false,
  },
  // server 配置：开发服务器端口。
  // - port: 5175：本微前端独立开发端口（products 是 5174，互不冲突）
  // - strictPort: true：端口占用直接报错，保证远程入口地址稳定
  server: {
    port: 5175,
    strictPort: true,
  },
});
