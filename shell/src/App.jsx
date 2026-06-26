/**
 * 文件：App.jsx
 * 所属模块：shell（主应用根组件）
 * 核心职责：
 *   1. 提供全局布局（Header + 内容区 + Footer）；
 *   2. 用 react-router-dom 做路由编排，把不同路径分发到不同子应用；
 *   3. 用 React.lazy + Suspense 动态加载远程子应用组件；
 *   4. 用 ErrorBoundary 错误边界捕获子应用加载失败，避免白屏。
 *
 * 关键概念：
 * - React.lazy + Suspense：lazy 把组件包装成“按需加载”，首次渲染时才去请求
 *   远程模块代码；Suspense 提供加载态 fallback，在模块未就绪时显示占位 UI。
 * - ErrorBoundary：React 类组件通过 getDerivedStateFromError / componentDidCatch
 *   捕获子树渲染错误。远程加载可能因端口没启动、网络失败而出错，必须用错误边界
 *   兜底，否则一个子应用挂掉会让整个主应用白屏。
 * - BrowserRouter：react-router-dom 的路由组件，被 shared 单例化后，
 *   子应用 import 的就是主应用这一份，因此能共享同一路由上下文与浏览历史。
 */

// Suspense：包裹异步组件，在加载期间显示 fallback；
// lazy：把动态 import 包装成可渲染的组件；
// Component：React 类组件基类，ErrorBoundary 需要用到。
import { Suspense, lazy, Component } from 'react';
// BrowserRouter：基于 HTML5 history API 的路由容器；
// Routes / Route：声明路由表与每条路由的匹配规则。
import { BrowserRouter, Routes, Route } from 'react-router-dom';
// 主应用自身的布局组件
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
// 主应用首页（本地组件，不走联邦）
import Home from './pages/Home.jsx';
// 多实例页（本地组件，内部用联邦加载多个子应用实例）
import MultiInstance from './pages/MultiInstance.jsx';

// 动态加载微前端（Module Federation 远程模块）
// import('productsApp/App') 中的 'productsApp' 就是 vite.config.js 里 remotes 的别名，
// '/App' 是子应用 exposes 暴露出来的模块名。lazy 让这段代码在路由命中时才请求。
const ProductsApp = lazy(() => import('productsApp/App'));
const CartApp = lazy(() => import('cartApp/App'));
const AuthApp = lazy(() => import('authApp/App'));
const OrderApp = lazy(() => import('orderApp/App'));
// workspaceApp：嵌套联邦演示。它既是 shell 的 remote，自身又加载 products/cart。
// 加载链路：shell → workspace → products/cart（三层联邦）。
const WorkspaceApp = lazy(() => import('workspaceApp/App'));

// 加载态占位组件：在远程模块代码下载完成前显示
function Loading() {
  return <div className="loading">加载中…</div>;
}

// 错误态占位组件：当子应用加载/渲染失败时显示给用户
function ShellError({ name }) {
  return (
    <div className="error-box">
      <h2>⚠️ 无法加载微前端：{name}</h2>
      <p>请确认该微前端已启动（检查端口）。</p>
    </div>
  );
}

// 包裹远程组件，捕获加载失败
// 这是一个工具函数：把“错误边界 + Suspense + 目标组件”组合起来返回一段 JSX。
// 这样每条路由都能复用同样的“兜底 + 加载态”逻辑。
function withBoundary(Comp, name) {
  return (
    <ErrorBoundary name={name}>
      {/* Suspense 负责处理“模块还在加载”的等待态 */}
      <Suspense fallback={<Loading />}>
        <Comp />
      </Suspense>
    </ErrorBoundary>
  );
}

// ErrorBoundary：错误边界必须是类组件（React 目前只支持类组件捕获渲染错误）。
// 作用：当子树（这里是被包裹的远程子应用）在渲染阶段抛错时，不让错误冒泡导致
// 整棵组件树卸载，而是降级显示 <ShellError />。
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    // hasError 标记当前是否处于“已捕获错误”的降级状态
    this.state = { hasError: false };
  }
  // 渲染阶段抛错时被调用，返回的对象会合并到 state，触发降级渲染
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  // 提交阶段（渲染完成后）被调用，适合用来记录错误日志
  componentDidCatch(err) {
    console.error('微前端加载失败:', err);
  }
  render() {
    // 若已捕获错误，渲染降级 UI；否则正常渲染子组件
    if (this.state.hasError) return <ShellError name={this.props.name} />;
    return this.props.children;
  }
}

// 主应用根组件：负责整体布局与路由分发
export default function App() {
  return (
    // BrowserRouter 包裹整棵树，提供路由上下文（location、history 等）。
    // 因为 react-router-dom 被 shared 单例化，子应用复用的就是这一个 BrowserRouter。
    <BrowserRouter>
      <div className="app-shell">
        <Header />
        <main className="main-content">
          {/* Routes 会根据当前 URL 匹配下面某一条 Route 的 element */}
          <Routes>
            {/* 首页：本地组件 */}
            <Route path="/" element={<Home />} />
            {/* 带 * 的路径表示“匹配该前缀下的所有子路径”，交给子应用内部路由处理 */}
            <Route path="/products/*" element={withBoundary(ProductsApp, 'Products')} />
            <Route path="/cart" element={withBoundary(CartApp, 'Cart')} />
            <Route path="/auth/*" element={withBoundary(AuthApp, 'Auth')} />
            <Route path="/orders/*" element={withBoundary(OrderApp, 'Order')} />
            <Route path="/checkout" element={withBoundary(OrderApp, 'Order')} />
            {/* 嵌套联邦演示页：workspace 内部又加载 products/cart */}
            <Route path="/workspace" element={withBoundary(WorkspaceApp, 'Workspace')} />
            {/* 多实例演示页：同时装载多个子应用实例（本地组件，内部用联邦） */}
            <Route path="/multi" element={<MultiInstance />} />
            {/* 兜底路由：所有未匹配的路径都走到这里，显示 404 */}
            <Route path="*" element={<div className="loading">404 - 页面不存在</div>} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
