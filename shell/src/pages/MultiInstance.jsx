/**
 * 文件：MultiInstance.jsx
 * 所属模块：shell（主应用的“多实例”页面）
 * 核心职责：演示“主应用加载多个实例的子应用”——
 *           用多个 Tab 同时装载多个子应用实例：
 *             · 3 个 products 实例（数码 / 电脑 / 穿戴）—— 同子应用、不同数据
 *             · 1 个 cart 实例—— 不同子应用
 *           所有实例始终保持挂载，切换 Tab 时只是用 display:none 隐藏，
 *           从而保留各自的独立状态（分类选择、搜索关键字、滚动位置等）。
 *
 * 关键概念——多实例（Multi-Instance）：
 *  - 普通加载：一个子应用在页面上只出现一次（如 /products 只渲染一个 ProductsApp）。
 *  - 多实例：同一个子应用组件在页面上同时渲染多份，每份有独立的状态与 props。
 *  - 实现要点：React.lazy 返回的组件本身就是一个普通组件，可以渲染任意多次。
 *    每次 <ProductsApp /> 都是一个独立实例，各自维护自己的 useState，互不影响。
 *  - “同子应用不同数据”：3 个 products 实例分别传入 initialCategory="数码/电脑/穿戴"，
 *    它们调用同一个 /api/products 接口，但带上不同的 category 参数，展示不同商品。
 *  - “不同子应用”：第 4 个 Tab 是 CartApp，与 products 是不同的微前端。
 *
 * 关键概念——保持挂载 + display:none 切换（而非条件渲染）：
 *  - 如果用条件渲染（active===0 才渲染第 0 个），切 Tab 会卸载旧实例、挂载新实例，
 *    之前选好的分类、输入的搜索词、滚动位置全部丢失，每次都要重新加载。
 *  - 改用“全部挂载 + display:none 隐藏非激活项”：实例一旦挂载就不会被卸载，
 *    切回来时状态完全保留。这模拟了“多 Tab 浏览器”里每个 Tab 独立保留状态的体验。
 *  - 代价：所有实例同时存在，首次进入要加载全部 4 份远程模块代码。
 *    但因为 Module Federation 的 shared，react 等只加载一份，实际开销主要在各实例的数据请求。
 *
 * 关键概念——embedded（嵌入模式）：
 *  - 每个 products 实例传 embedded={true}，关闭卡片点击跳详情（避免切走宿主路由），
 *    并隐藏自身的“全部商品”标题（由 Tab 标签代替）。
 *  - cart 实例传 embedded={true}，隐藏标题与“去结算”操作栏，只保留列表+增删。
 */

// Suspense：包裹异步组件，加载期间显示 fallback；
// lazy：把动态 import 包装成可渲染组件；
// Component：React 类组件基类，ErrorBoundary 需要用到；
// memo：高阶组件，props 不变时跳过重渲染（性能优化）；
// useState：管理当前激活的 Tab 索引。
import { Suspense, lazy, Component, memo, useState } from 'react';

// 动态加载远程子应用（Module Federation）
// 注意：ProductsApp / CartApp 是 lazy 组件，下面会渲染多次，
// 每次渲染都是一个独立实例（独立 state），这正是“多实例”的核心。
const ProductsApp = lazy(() => import('productsApp/App'));
const CartApp = lazy(() => import('cartApp/App'));

// 加载态占位组件
function Loading() {
  return <div className="loading">加载中…</div>;
}

// 错误态占位组件
function LoadError({ name }) {
  return (
    <div className="error-box">
      <h2>⚠️ 无法加载子应用：{name}</h2>
      <p>请确认该微前端已启动（检查端口）。</p>
    </div>
  );
}

// ErrorBoundary：错误边界，捕获某个实例的加载/渲染错误，避免影响其它实例
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.error('子应用实例加载失败:', err);
  }
  render() {
    if (this.state.hasError) return <LoadError name={this.props.name} />;
    return this.props.children;
  }
}

// 单个实例面板：用 React.memo 包裹（性能优化）。
// 为什么需要 memo？切 Tab 时 active 变化会让整个 MultiInstance 重渲染，
// 如果不 memo，所有已挂载实例都会跟着重新执行渲染函数（即使 props 没变）。
// memo 后，只要传入的 tab 引用不变（tabs 是模块级常量，引用稳定），
// React 就跳过本次重渲染，只更新外层 div 的 display 样式，大幅减少无谓工作。
const InstancePane = memo(function InstancePane({ tab }) {
  return (
    <ErrorBoundary name={tab.key}>
      <Suspense fallback={<Loading />}>
        {/* 根据 type 渲染对应子应用，并传入 embedded 与 initialCategory。
            每次 <ProductsApp /> 都是一个独立实例，state 互不影响。 */}
        {tab.type === 'products' ? (
          <ProductsApp initialCategory={tab.initialCategory} embedded />
        ) : (
          <CartApp embedded />
        )}
      </Suspense>
    </ErrorBoundary>
  );
});

// Tab 配置：每个 Tab 对应一个子应用实例。
// - type: 'products' 渲染 ProductsApp；type: 'cart' 渲染 CartApp
// - initialCategory: products 实例的初始分类（同子应用不同数据的关键）
// - 4 个 Tab：前 3 个是 products 的不同分类实例，第 4 个是 cart 实例（不同子应用）
const tabs = [
  { key: '数码', type: 'products', initialCategory: '数码', icon: '🎧' },
  { key: '电脑', type: 'products', initialCategory: '电脑', icon: '💻' },
  { key: '穿戴', type: 'products', initialCategory: '穿戴', icon: '⌚' },
  { key: '购物车', type: 'cart', icon: '🛍️' },
];

// 多实例页面组件
export default function MultiInstance() {
  // active：当前激活的 Tab 索引（0~3）。切 Tab 只改这个 state。
  const [active, setActive] = useState(0);
  // mounted：记录已经挂载过的 Tab 索引集合（性能优化 · 懒挂载）。
  // 初始只挂载第 0 个 Tab；切到其它 Tab 时才把它加入集合真正渲染。
  // 这样首次进入页面只会加载当前 Tab 的子应用，而不是一次性加载全部 4 个，
  // 显著减少首屏的远程模块下载与数据请求数量。
  // 已挂载的 Tab 始终保留在集合里，切走不会卸载，状态完整保留。
  const [mounted, setMounted] = useState(() => new Set([0]));

  // 切 Tab：更新激活索引，并把该 Tab 标记为已挂载。
  const show = (i) => {
    setActive(i);
    setMounted((prev) => {
      // 已挂载过则返回原引用（保持引用相等，避免触发无谓的重渲染）
      if (prev.has(i)) return prev;
      const next = new Set(prev);
      next.add(i);
      return next;
    });
  };

  return (
    <div>
      <h1 className="page-title">🗂️ 多实例演示</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        同一个子应用（products）被装载 3 份，分别展示数码 / 电脑 / 穿戴 分类（同子应用、不同数据）；
        第 4 个 Tab 是 cart 子应用（不同子应用）。所有已访问过的实例始终保持挂载，切换 Tab 只切换显示，
        各实例的状态（分类、搜索词等）相互独立、互不干扰。加购后会通过事件总线联动刷新购物车实例。
      </p>

      {/* Tab 栏：点击切换 active，NavLink 风格的高亮 */}
      <div className="cat-bar" style={{ marginBottom: 16 }}>
        {tabs.map((t, i) => (
          <button
            key={t.key}
            className={'cat-chip' + (active === i ? ' active' : '')}
            onClick={() => show(i)}
          >
            {t.icon} {t.key}
          </button>
        ))}
      </div>

      {/* 实例容器：懒挂载 + display:none 切换。
          - 懒挂载：未访问过的 Tab（!mounted.has(i)）直接渲染 null，首次切到才挂载；
          - display:none：已挂载的实例切走时只隐藏不卸载，状态完整保留。
          两项配合：首屏只加载当前 Tab，后续按需加载，且加载后不丢状态。 */}
      <div>
        {tabs.map((t, i) =>
          mounted.has(i) ? (
            <div key={t.key} style={{ display: active === i ? 'block' : 'none' }}>
              <InstancePane tab={t} />
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
