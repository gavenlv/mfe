/**
 * 文件：bootstrap.jsx
 * 所属微前端：cart（购物车微前端）
 * 核心职责：真正执行 React 渲染的“启动文件”，把根组件 <App /> 挂载到页面 DOM 上。
 *
 * 关键概念——为什么和 main.jsx 分开？（见 main.jsx 的说明）
 *  - main.jsx 用动态 import 延迟加载本文件，形成“异步边界”，
 *    让共享依赖（react/react-dom）能正确复用宿主的那一份。
 *  - 所以 React 的 import 必须放在这里（bootstrap），而不是 main.jsx。
 *
 * 关键概念——本地开发 vs 被宿主加载：
 *  - 本地独立开发时：浏览器加载 index.html → main.jsx → bootstrap.jsx → 渲染。
 *  - 被宿主加载时：宿主通过 remoteEntry.js 直接拿 exposes 的 ./App，
 *    不会执行 main/bootstrap，渲染由宿主的根组件负责。
 *  - 因此本文件主要服务于“本地独立开发调试”场景。
 */

// React：核心库，提供 JSX 运行时支持。因 shared 配置，运行时复用宿主实例
import React from 'react';
// ReactDOM/client：React 18 的新 API，用于把 React 树挂载到真实 DOM
import ReactDOM from 'react-dom/client';
// App：本微前端的根组件，也是模块联邦 exposes 给宿主的那个模块
import App from './App.jsx';
// 引入共享样式表。shared/styles.css 是整个项目共用的“设计系统样式”，
// 包含按钮、卡片、栅格等通用样式类，让多个微前端外观统一。
// 这里用相对路径 ../../shared/ 跳出 cart/src 到 mfe/shared/。
import '../../shared/styles.css';

// createRoot：React 18 的挂载 API，参数是真实 DOM 节点。
// document.getElementById('root')：取 index.html 里 id="root" 的 div。
// .render(...)：把 <App /> 这棵组件树渲染进去。
ReactDOM.createRoot(document.getElementById('root')).render(
  // React.StrictMode：开发模式下的严格模式，会额外检测潜在问题
  // （如不安全的生命周期、副作用重复执行等），生产构建不影响。
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
