/**
 * 文件：main.jsx
 * 所属微前端：products（商品微前端）
 * 核心职责：整个微前端的“入口文件”，但这里只有一行代码——动态 import bootstrap.jsx。
 *
 * 关键概念——为什么入口要这么写？（异步边界原理）
 *  - 模块联邦要求：共享依赖（react 等）必须先由宿主加载并注册，微前端才能用。
 *  - 如果入口文件直接静态 import React 并渲染，Webpack/Vite 会在解析入口时
 *    就把 React 当作本微前端的私有依赖打包，导致“共享依赖”失效，出现两份 React。
 *  - 解决办法：入口文件只写一个动态 import('./bootstrap.jsx')，
 *    这会延迟 bootstrap 的执行，等异步 chunk 加载时，共享依赖已经准备好，
 *    bootstrap 里再 import React 才能正确复用宿主的那一份。
 *  - 这就是所谓的“异步边界（async boundary）”：用动态 import 把共享依赖的解析
 *    推迟到运行时，从而让 shared 生效。
 *
 * 注意：main.jsx 是独立运行（本地开发）时的入口；被宿主加载时，
 *       宿主走的是 remoteEntry.js → exposes 的 ./App，并不会执行 main.jsx。
 */
import('./bootstrap.jsx');
