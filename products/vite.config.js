/**
 * 文件：vite.config.js
 * 所属微前端：products（商品微前端）
 * 核心职责：配置 Vite 构建工具，并通过 Module Federation（模块联邦）
 *           把本微前端的 App 组件“暴露”出去，供宿主（host）远程加载。
 *
 * 关键概念——Module Federation（模块联邦）：
 *  - 微前端的核心机制之一。一个项目可以是 host（加载方）或 remote（被加载方）。
 *  - 本文件配置的是 remote 角色：把 products 应用打包成一个可被远程引用的入口。
 *  - filename: 'remoteEntry.js' 会在构建产物里生成一个“远程入口文件”，
 *    宿主通过加载这个文件，就能拿到本微前端暴露的模块。
 *  - exposes：声明本微前端对外暴露哪些模块，key 是外部引用时的路径
 *    （例如 host 里写 import('productsApp/App'），value 是本项目的源文件路径。
 *  - shared：把公共依赖（react、react-dom、react-router-dom）标记为“共享依赖”，
 *    这样宿主和多个微前端运行时只会加载一份 React，避免出现多份 React 实例
 *    导致 hooks 报错、上下文丢失等问题。
 */

// defineConfig：Vite 提供的工具函数，能给配置对象提供类型提示，不影响运行
import { defineConfig } from 'vite';
// @vitejs/plugin-react：Vite 官方 React 插件，提供 JSX、Fast Refresh 等能力
import react from '@vitejs/plugin-react';
// @originjs/vite-plugin-federation：社区实现的 Module Federation 插件，
// 让 Vite 项目支持模块联邦（webpack 原生支持，Vite 需要这个插件）
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    // React 插件：让 Vite 能编译 JSX、提供热更新
    react(),
    // 模块联邦配置：本微前端作为 remote 被宿主加载
    federation({
      // name：本微前端的唯一标识，宿主引用时会用到（如 productsApp/App）
      name: 'productsApp',
      // filename：构建产出的远程入口文件名，宿主通过加载它来获取本微前端模块
      filename: 'remoteEntry.js',
      // exposes：对外暴露的模块映射。
      // './App' 是对外暴露的路径名，'./src/App.jsx' 是本项目内的源文件。
      // 这样宿主可以写 import('productsApp/App') 来加载本微前端的根组件。
      exposes: { './App': './src/App.jsx' },
      // shared：共享依赖列表。宿主和所有微前端共用同一份这些库，
      // 避免重复加载、避免多份 React 实例造成的 hooks/context 问题。
      shared: ['react', 'react-dom', 'react-router-dom'],
    }),
  ],
  // build 配置：
  // - target: 'esnext'：构建目标设为最新 JS 标准，因为模块联邦依赖动态 import 等特性
  // - cssCodeSplit: false：关闭 CSS 拆分，保证样式被打包进远程入口，便于共享
  build: { target: 'esnext', cssCodeSplit: false },
  // server 配置：开发服务器端口。
  // - port: 5174：本微前端独立开发的端口
  // - strictPort: true：端口被占用时直接报错，不自动切换，
  //   因为模块联邦的远程入口地址需要稳定，端口变了宿主就加载不到了
  server: { port: 5174, strictPort: true },
});
