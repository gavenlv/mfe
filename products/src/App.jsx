/**
 * 文件：App.jsx
 * 所属微前端：products（商品微前端）
 * 核心职责：本微前端的根组件，根据当前 URL 路径决定显示“商品列表”还是“商品详情”。
 *
 * 关键概念——为什么这里不写自己的 BrowserRouter？
 *  - 在单体 React 应用里，通常会在根组件包一层 <BrowserRouter> 来提供路由能力。
 *  - 但在微前端里，react-router-dom 被配置为 shared 共享依赖，且宿主（host）
 *    已经在最外层挂了 <BrowserRouter>。如果每个微前端再各自包一层 BrowserRouter，
 *    会出现“多个 Router 实例”，导致 URL 状态、导航跳转混乱。
 *  - 正确做法：微前端里直接使用 useLocation/useNavigate/Link 等 hooks，
 *    它们会自动接入宿主提供的路由上下文，复用同一套路由状态。
 *  - 所以本文件只做“读当前路径 + 决定渲染哪个子组件”，不引入 Router 组件。
 *
 * 关键概念——简易路由匹配：
 *  - 这里没用 <Route> 声明式路由，而是用正则匹配 pathname，做一个轻量分发。
 *  - 匹配 /products/数字 → 商品详情；其余 → 商品列表。
 *
 * 关键概念——embedded（嵌入模式）与 initialCategory（初始分类）：
 *  - 进阶用法：本微前端除了被 shell 直接作为“页面”加载，还可能被另一个微前端
 *    （workspace）作为“子组件”嵌入，或在主应用的 /multi 多实例页里同时装载多份。
 *  - embedded=true 时，本组件不再根据 URL 路由分发，而是始终渲染 ProductList，
 *    并把 embedded 透传给它，让列表关闭“卡片点击跳详情”的导航行为，
 *    使其成为一个“只展示/可加购”的独立组件，不会把宿主的路由搅乱。
 *  - initialCategory 用于“同子应用不同数据”的演示：多个 products 实例分别传入
 *    不同的初始分类（如 '数码' / '电脑' / '穿戴'），各自展示不同数据，互不影响。
 *  - 注意：useLocation 必须无条件调用（React Hooks 规则），所以即便 embedded
 *    模式用不到 location，也要在分支之前先调用。
 */

// React：JSX 运行时依赖（shared 复用宿主实例）
import React from 'react';
// useLocation：从 react-router-dom 读取当前路由信息（含 pathname 等）。
// 因为 react-router-dom 是 shared，这里复用的是宿主的路由上下文。
import { useLocation } from 'react-router-dom';
// ProductList：商品列表组件，展示全部商品、支持搜索和分类筛选
import ProductList from './components/ProductList.jsx';
// ProductDetail：商品详情组件，展示单个商品的详细信息和购买操作
import ProductDetail from './components/ProductDetail.jsx';

// 本微前端的根组件，也是被 exposes('./App') 暴露给宿主的模块
// props 说明：
//  - embedded: boolean，嵌入模式。true 时始终渲染列表，不做详情路由分发
//  - initialCategory: string，列表的初始分类（如 '数码'），用于多实例区分数据
export default function ProductsApp({ initialCategory, embedded } = {}) {
  // useLocation() 返回当前路由 location 对象，pathname 即 URL 的路径部分。
  // 必须在所有 return 之前无条件调用，否则违反 Hooks 规则。
  const location = useLocation();

  // 嵌入模式：始终渲染 ProductList，不做 URL 路由分发。
  // 这样被 workspace 嵌入或在 /multi 多实例页里时，不会因宿主 URL 变化而切到详情。
  if (embedded) {
    return <ProductList initialCategory={initialCategory} embedded />;
  }

  // 常规模式：用正则匹配路径形如 /products/123 的 URL：
  //  - ^\/products\/  以 /products/ 开头
  //  - (\d+)           捕获一段数字（商品 id）
  //  - $               直到结尾
  // match[1] 就是括号里捕获到的商品 id 字符串
  const match = location.pathname.match(/^\/products\/(\d+)$/);
  if (match) {
    // 命中详情路由：把捕获到的 id 传给 ProductDetail 渲染详情页
    return <ProductDetail id={match[1]} />;
  }
  // 否则（如 /products、/products?xxx）渲染商品列表
  return <ProductList />;
}
