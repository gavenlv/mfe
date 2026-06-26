/**
 * 文件：Home.jsx
 * 所属模块：shell（主应用首页）
 * 核心职责：渲染首页内容，包括 Hero 标语、四个微前端模块入口卡片、架构示意图。
 *           属于纯展示组件，主要用 Link 引导用户跳转到各子应用路由。
 *
 * 关键概念：
 * - Link：react-router-dom 的路由链接，渲染成 <a> 但点击不刷新整页，
 *   只切换前端路由，体验更顺滑。
 * - 数据驱动渲染：把四个模块的信息存在 features 数组里，用 .map 渲染卡片，
 *   避免重复写四遍结构相似的 JSX。
 */

// Link 用于卡片点击跳转到对应子应用路由
import { Link } from 'react-router-dom';

// 四个微前端模块的入口信息：图标、标题、描述、目标路由
// 这里把数据抽成数组，下面用 map 渲染，比手写四遍卡片更易维护
const features = [
  { icon: '📦', title: '商品微前端', desc: '商品列表与详情，端口 5174', to: '/products' },
  { icon: '🛍️', title: '购物车微前端', desc: '购物车管理，端口 5175', to: '/cart' },
  { icon: '🔐', title: '认证微前端', desc: '登录注册，端口 5176', to: '/auth/login' },
  { icon: '📋', title: '订单微前端', desc: '结算与订单，端口 5177', to: '/orders' },
];

// 进阶演示入口：嵌套联邦 + 多实例
const advanced = [
  { icon: '🧩', title: '工作台（嵌套联邦）', desc: 'workspace(5178) 被 shell 加载，又内部加载 products/cart，形成三层联邦', to: '/workspace' },
  { icon: '🗂️', title: '多实例演示', desc: '同一子应用装载多份（数码/电脑/穿戴），同子应用不同数据 + 不同子应用', to: '/multi' },
];

// 首页组件：Hero 区 + 模块卡片区 + 架构图区
export default function Home() {
  return (
    <div className="home">
      {/* Hero：首屏大标题与主行动按钮 */}
      <section className="hero">
        <h1>🛒 ShopMFE 微前端电商</h1>
        <p className="hero-sub">
          基于 Vite Module Federation 构建，每个业务模块独立部署、独立开发。
        </p>
        <Link to="/products" className="btn-primary btn-lg">开始购物 →</Link>
      </section>

      {/* 四个微前端模块入口卡片 */}
      <section className="features">
        <h2>微前端模块</h2>
        <div className="feature-grid">
          {/* 遍历 features 数组渲染卡片，key 用标题保证唯一 */}
          {features.map((f) => (
            <Link to={f.to} key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* 进阶演示入口：嵌套联邦 + 多实例 */}
      <section className="features">
        <h2>进阶演示</h2>
        <div className="feature-grid">
          {advanced.map((f) => (
            <Link to={f.to} key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* 架构示意图：用 <pre> 展示 ASCII 字符画，说明整体架构 */}
      <section className="arch">
        <h2>架构说明</h2>
        <div className="arch-box">
          <pre>{`┌──────────────────────────────────────────┐
│  Shell 主应用 (localhost:5173)           │
│  路由编排 · 全局布局 · 跨模块通信         │
└──┬───────┬──────────┬─────────┬────────┘
   │       │          │         │
   │  ┌────▼───┐ ┌────▼──┐ ┌────▼──┐ ┌─────▼────┐
   │  │Products│ │ Cart  │ │ Auth  │ │  Order   │
   │  │ :5174  │ │:5175  │ │:5176  │ │  :5177   │
   │  └────┬───┘ └───┬──┘ └───┬───┘ └─────┬────┘
   │       │         │        │           │
   │  ┌────▼──────────▼────────▼───────────▼───┐
   └─►│  Workspace(:5178) 嵌套联邦 · 又加载 ↑  │
      │  /workspace 页 · 同时被 shell 加载      │
      └────────────────────────────────────────┘
                      │
              ┌───────▼────────┐
              │ Express +SQLite│
              │  :3001         │
              └────────────────┘

多实例(/multi)：shell 同时装载 3 份 Products + 1 份 Cart
  · 同子应用不同数据：3 份 Products 各传不同 initialCategory
  · 不同子应用：第 4 个 Tab 是 Cart`}</pre>
        </div>
      </section>
    </div>
  );
}
