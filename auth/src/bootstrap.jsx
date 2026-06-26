/**
 * 文件级注释：bootstrap.jsx
 * 所属微前端：auth（认证微前端）
 * 核心职责：在 shared 依赖协商完成后，真正挂载 React 应用到 DOM。
 * 关键概念：
 *   1. 异步边界：本文件由 main.jsx 用动态 import() 异步加载，
 *      确保 React 等 shared 依赖先完成"宿主/微前端"之间的单例协商，
 *      再执行下面的渲染逻辑，避免出现两份 React 实例。
 *   2. 独立运行模式：当 auth 微前端不挂在宿主下、单独启动开发时，
 *      这里直接 createRoot 挂载到 index.html 的 #root 节点，
 *      让开发者可以单独调试登录/注册页面。
 *   3. 被宿主加载模式：当作为 remote 被宿主加载时，宿主拿的是 ./App，
 *      本文件不会在宿主里执行；本文件只服务于"独立开发"场景。
 */
import React from 'react'; // React 核心库（shared 共享依赖，独立运行时由本微前端自行加载）
import ReactDOM from 'react-dom/client'; // React 18 的新版 DOM 挂载 API（createRoot）
import App from './App.jsx'; // 当前微前端的根组件
import '../../shared/styles.css'; // 引入共享设计系统样式（shared/styles.css）：
                                  // auth 与 order、products 等微前端共用同一套样式表，
                                  // 保证按钮、卡片、表单等视觉风格统一，避免每个微前端各写一套 CSS。

ReactDOM.createRoot(document.getElementById('root')).render(
  // React.StrictMode：开发模式下会故意双调用渲染函数以帮助发现副作用 bug，生产构建无影响。
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
