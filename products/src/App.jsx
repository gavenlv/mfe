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
export default function ProductsApp() {
  // useLocation() 返回当前路由 location 对象，pathname 即 URL 的路径部分
  const location = useLocation();
  // 用正则匹配路径形如 /products/123 的 URL：
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
