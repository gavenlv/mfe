import { Link } from 'react-router-dom';

const features = [
  { icon: '📦', title: '商品微前端', desc: '商品列表与详情，端口 5174', to: '/products' },
  { icon: '🛍️', title: '购物车微前端', desc: '购物车管理，端口 5175', to: '/cart' },
  { icon: '🔐', title: '认证微前端', desc: '登录注册，端口 5176', to: '/auth/login' },
  { icon: '📋', title: '订单微前端', desc: '结算与订单，端口 5177', to: '/orders' },
];

export default function Home() {
  return (
    <div className="home">
      <section className="hero">
        <h1>🛒 ShopMFE 微前端电商</h1>
        <p className="hero-sub">
          基于 Vite Module Federation 构建，每个业务模块独立部署、独立开发。
        </p>
        <Link to="/products" className="btn-primary btn-lg">开始购物 →</Link>
      </section>

      <section className="features">
        <h2>微前端模块</h2>
        <div className="feature-grid">
          {features.map((f) => (
            <Link to={f.to} key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="arch">
        <h2>架构说明</h2>
        <div className="arch-box">
          <pre>{`┌─────────────────────────────────────┐
│  Shell 主应用 (localhost:5173)      │
│  路由编排 · 全局布局 · 跨模块通信    │
└──────┬──────────┬─────────┬────────┘
       │          │         │
   ┌───▼───┐ ┌───▼──┐ ┌───▼──┐ ┌────▼───┐
   │Products│ │ Cart │ │ Auth │ │ Order  │
   │ :5174  │ │:5175 │ │:5176 │ │ :5177  │
   └───┬───┘ └───┬──┘ └───┬──┘ └────┬───┘
       │         │        │         │
       └─────────┴────────┴─────────┘
                    │
            ┌───────▼────────┐
            │  Express +SQLite│
            │  :3001          │
            └────────────────┘`}</pre>
        </div>
      </section>
    </div>
  );
}
