/**
 * 文件：bootstrap.jsx
 * 所属模块：shell（主应用真正的启动逻辑）
 * 核心职责：在 Module Federation 的 shared 依赖初始化完成后，
 *           挂载 React 根组件到页面 DOM 上。
 *
 * 关键概念：
 * - 这个文件由 main.jsx 通过动态 import('bootstrap') 异步加载进来。
 *   等到这一步执行时，联邦的 shared 依赖（react 等）已经协商完毕，
 *   此时再正常同步使用 React 就是安全的。
 * - createRoot 是 React 18 的新 API，用于创建并发渲染根节点；
 *   StrictMode 是开发模式下的严格检查包装器，会额外渲染一次以暴露副作用问题。
 */

// React 默认导出，提供 StrictMode 等能力（shared 单例化后与子应用共用同一份）
import React from 'react';
// ReactDOM/client 提供挂载到 DOM 的 createRoot API（React 18 版本）
import ReactDOM from 'react-dom/client';
// 主应用根组件，负责路由编排与全局布局
import App from './App.jsx';
// 全局样式。CSS 直接 import 即可，Vite 会把它注入到页面 <head> 中
import './styles.css';

// document.getElementById('root') 取到 index.html 里的 <div id="root">
// createRoot 创建 React 18 的并发根节点，render 把 <App /> 渲染进去
ReactDOM.createRoot(document.getElementById('root')).render(
  // StrictMode：仅在开发环境生效，会对组件渲染、副作用做额外检查，
  // 帮助发现不安全的写法（如修改状态时不纯的函数）。生产构建自动去除。
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
