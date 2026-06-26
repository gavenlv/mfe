/**
 * 文件：App.jsx
 * 所属微前端：workspace（工作台微前端）
 * 核心职责：演示“嵌套联邦”——本微前端被宿主 shell 加载，同时它内部又加载
 *           products 与 cart 两个子应用，形成一个“工作台”页面：
 *           左侧是商品列表（限定“数码”分类），右侧是迷你购物车。
 *
 * 关键概念——嵌套联邦（Nested Federation）：
 *  - 加载链路：shell(host) → workspace(remote+host) → products/cart(remote)
 *  - workspace 通过 remotes 配置引用 productsApp/cartApp，再用 React.lazy 动态加载。
 *  - 因为 react/react-dom/react-router-dom 都是 shared，整条链路共用一份 React，
 *    workspace 加载的 productsApp 复用的就是 shell 那一份 react，不会出现多份实例。
 *  - 这证明了 Module Federation 的“共享作用域”是全局的：不管中间隔了几层，
 *    shared 依赖都只加载一次，所有微前端复用同一份。
 *
 * 关键概念——embedded（嵌入模式）的应用：
 *  - 本页面把 products 和 cart 当作“组件”嵌入，而不是“页面”。
 *  - 传 embedded={true} 让它们关闭自身的导航行为（不跳详情、不跳结算），
 *    避免点击把宿主路由切走，让它们安分地待在工作台里。
 *  - 给 products 传 initialCategory="数码"，演示“同子应用不同数据”——
 *    这里只展示数码分类，而 shell 的 /products 路由展示全部分类。
 *
 * 关键概念——不包 BrowserRouter：
 *  - 和 products/cart 一样，workspace 不写自己的 BrowserRouter。
 *    react-router-dom 是 shared，useLocation/useNavigate 会自动接入 shell 的路由。
 *    如果再包一层 BrowserRouter，会出现多个 Router 实例，URL 状态混乱。
 *
 * 关键概念——Suspense + ErrorBoundary：
 *  - 远程模块加载是异步的，首次渲染时还没下载完，需要 Suspense 提供 fallback。
 *  - 远程加载可能失败（端口没启动、网络问题），需要 ErrorBoundary 兜底，
 *    否则一个子应用挂掉会让整个工作台白屏。
 */

// Suspense：包裹异步组件，加载期间显示 fallback；
// lazy：把动态 import 包装成可渲染组件；
// Component：React 类组件基类，ErrorBoundary 需要用到。
import { Suspense, lazy, Component } from 'react';

// 动态加载下游子应用（Module Federation 远程模块）
// import('productsApp/App') 中的 'productsApp' 是 vite.config.js 里 remotes 的别名，
// '/App' 是子应用 exposes 暴露出来的模块名。
// 注意：workspace 自己也是被 shell 通过 import('workspaceApp/App') 加载的，
// 这里它又去 import productsApp/cartApp，形成“嵌套联邦”。
const ProductsApp = lazy(() => import('productsApp/App'));
const CartApp = lazy(() => import('cartApp/App'));

// 加载态占位组件：在远程模块代码下载完成前显示
function Loading() {
  return <div className="loading">加载中…</div>;
}

// 错误态占位组件：当下游子应用加载/渲染失败时显示
function LoadError({ name }) {
  return (
    <div className="error-box">
      <h2>⚠️ 无法加载子应用：{name}</h2>
      <p>请确认该微前端已启动（检查端口）。</p>
    </div>
  );
}

// ErrorBoundary：错误边界（必须是类组件）。
// 当被包裹的下游子应用在渲染阶段抛错时，降级显示 <LoadError />，
// 不让错误冒泡导致整个工作台白屏。
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
    console.error('下游子应用加载失败:', err);
  }
  render() {
    // 若已捕获错误，渲染降级 UI；否则正常渲染子组件
    if (this.state.hasError) return <LoadError name={this.props.name} />;
    return this.props.children;
  }
}

// 工作台根组件：左侧商品列表 + 右侧迷你购物车
export default function App() {
  return (
    <div>
      <h1 className="page-title">🧩 工作台（嵌套联邦演示）</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        本页面由 workspace 微前端提供。workspace 既被 shell 加载，又内部加载 products 与 cart，
        形成 <code>shell → workspace → products/cart</code> 三层嵌套联邦。
      </p>

      {/* 左右两栏布局：workspace-grid 是自定义类名，配合内联样式实现两列 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* 左栏：嵌入商品列表（限定数码分类）。
            embedded 关闭卡片跳详情；initialCategory="数码" 让它只展示数码分类。 */}
        <div className="card">
          <h2 style={{ margin: '0 0 12px 0' }}>数码商品（来自 products 微前端）</h2>
          <ErrorBoundary name="Products">
            <Suspense fallback={<Loading />}>
              <ProductsApp initialCategory="数码" embedded />
            </Suspense>
          </ErrorBoundary>
        </div>

        {/* 右栏：嵌入迷你购物车。
            embedded 关闭标题与底部“去结算”操作栏，只展示列表+增删。 */}
        <div className="card">
          <h2 style={{ margin: '0 0 12px 0' }}>购物车（来自 cart 微前端）</h2>
          <ErrorBoundary name="Cart">
            <Suspense fallback={<Loading />}>
              <CartApp embedded />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
