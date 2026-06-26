/**
 * 文件：vite.config.js
 * 所属微前端：workspace（工作台微前端）
 * 核心职责：配置 Module Federation，让本微前端同时扮演两个角色——
 *           1. remote（被加载方）：通过 exposes 把 ./App 暴露给宿主 shell；
 *           2. host（加载方）：通过 remotes 引用 productsApp 与 cartApp。
 *
 * 关键概念——嵌套联邦（Multi-level / Nested Federation）：
 *  - 普通联邦是“两层”：shell(host) → products/cart(remote)。
 *  - 嵌套联邦是“三层”：shell(host) → workspace(既是 remote 又是 host) → products/cart(remote)。
 *  - workspace 被 shell 加载，同时它内部又加载 products/cart。
 *    这就好比“俄罗斯套娃”：一个微前端里嵌套了另一个微前端。
 *  - 为什么这样可行？因为 Module Federation 的 shared 依赖是全局共享的：
 *    shell 启动时加载了 react/react-dom/react-router-dom 并注册到全局共享作用域，
 *    workspace 加载时复用同一份 react，再加载 products/cart 时它们也复用同一份 react。
 *    整条链路只有一份 React 实例，不会出现“多份 React 导致 hooks 报错”的问题。
 *  - 关键限制：要复用宿主的路由上下文，workspace 不能再包一层 BrowserRouter，
 *    它内部的 useLocation/useNavigate 会自动接入 shell 的路由（因为 react-router-dom 是 shared）。
 *
 * 配置项说明：
 *  - name: 'workspaceApp'，本微前端的联邦唯一标识，shell 里用 import('workspaceApp/App') 引用
 *  - filename: 'remoteEntry.js'，构建产出的远程入口文件，shell 通过加载它来获取本微前端模块
 *  - exposes: 对外暴露 ./App，供 shell 远程加载
 *  - remotes: 声明要引用的下游子应用（productsApp / cartApp），地址指向它们各自的 remoteEntry.js
 *  - shared: 共享依赖，整条联邦链路共用一份 react 等
 */

// defineConfig：Vite 提供的工具函数，给配置对象提供类型提示，不影响运行
import { defineConfig } from 'vite';
// @vitejs/plugin-react：Vite 官方 React 插件，提供 JSX、Fast Refresh 等能力
import react from '@vitejs/plugin-react';
// @originjs/vite-plugin-federation：社区实现的 Module Federation 插件
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    // React 插件：让 Vite 能编译 JSX、提供热更新
    react(),
    // 模块联邦配置：本微前端“既是 remote 又是 host”（嵌套联邦的核心）
    federation({
      // name：本微前端的唯一标识，宿主 shell 引用时会用到（如 workspaceApp/App）
      name: 'workspaceApp',
      // filename：构建产出的远程入口文件名，shell 通过加载它来获取本微前端模块
      filename: 'remoteEntry.js',
      // exposes：对外暴露的模块映射。shell 用 import('workspaceApp/App') 加载本微前端根组件。
      exposes: { './App': './src/App.jsx' },
      // remotes：声明本微前端要引用的下游子应用。
      // workspace 作为 host，加载 productsApp 与 cartApp，形成三层嵌套联邦：
      //   shell → workspace → products / cart
      // 地址指向各子应用构建产出的 remoteEntry.js。
      remotes: {
        productsApp: 'http://localhost:5174/assets/remoteEntry.js',
        cartApp: 'http://localhost:5175/assets/remoteEntry.js',
      },
      // shared：共享依赖列表。整条联邦链路（shell / workspace / products / cart）
      // 运行时只会加载一份 react，避免重复加载与多份 React 实例问题。
      shared: ['react', 'react-dom', 'react-router-dom'],
    }),
  ],
  // build 配置：
  // - target: 'esnext'：构建目标设为最新 JS 标准，模块联邦依赖动态 import 等特性
  // - cssCodeSplit: false：关闭 CSS 拆分，保证样式随远程入口一起加载
  build: { target: 'esnext', cssCodeSplit: false },
  // server 配置：开发服务器端口。
  // - port: 5178：本微前端独立开发的端口
  // - strictPort: true：端口被占用时直接报错，不自动切换，
  //   因为模块联邦的远程入口地址需要稳定，端口变了 shell 就加载不到了
  server: { port: 5178, strictPort: true },
});
