/**
 * 文件：main.jsx
 * 所属模块：shell（主应用入口）
 * 核心职责：作为整个主应用的“最外层入口”，只做一件事——动态导入 bootstrap.jsx。
 *
 * 关键概念：为什么要拆成 main.jsx + bootstrap.jsx 两个文件？
 * 这是 Module Federation 的“异步边界（async boundary）”要求。
 * Module Federation 在初始化时需要先去协商 shared 依赖（比如确认 react 用哪一份），
 * 这个过程是异步的。如果入口文件直接同步 import React 并渲染，React 可能在
 * 共享依赖还没就绪时就被执行，导致用到错误或重复的 React 实例。
 *
 * 因此约定：入口文件（main.jsx）只做一次动态 import('bootstrap')，
 * 把真正的应用启动逻辑放到 bootstrap.jsx 里。这次动态 import 会形成一个
 * 异步加载点，给联邦插件留出初始化 shared 依赖的时机，之后再去执行渲染。
 */

// 动态 import：返回 Promise，异步加载 bootstrap.jsx 模块。
// 这里不写 .then() 也能工作——模块加载后会自动执行其顶层代码（即渲染应用）。
// 这一行就是 Module Federation 所需的“异步边界”。
import('./bootstrap.jsx');
