# ShopMFE — 基于 Module Federation 的微前端电商

每个业务模块是一个独立的微前端（独立 Vite 应用、独立端口），由 Shell 主应用通过 Module Federation 动态加载；后端使用 Express + SQLite 存储数据。

> 📚 **完整设计与学习文档** 见 [`docs/`](./docs/README.md)：架构设计、Module Federation 原理、后端 API、通信机制、逐文件解析、前端知识扫盲，代码已全部加上教学型中文注释，适合零基础学习。

## 架构

```
┌──────────────────────────────────────────┐
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
      │  /workspace · 同时被 shell 加载         │
      └────────────────────────────────────────┘
                      │
              ┌───────▼────────┐
              │ Express +SQLite│
              │  :3001         │
              └────────────────┘
```

| 模块 | 端口 | 职责 |
|------|------|------|
| shell | 5173 | 主应用：路由、Header/Footer、购物车角标、跨模块事件总线 |
| products | 5174 | 商品列表（分类/搜索）、商品详情、加入购物车 |
| cart | 5175 | 购物车增删改、合计、去结算 |
| auth | 5176 | 登录 / 注册（JWT） |
| order | 5177 | 结算下单、订单列表、订单详情 |
| workspace | 5178 | 工作台微前端：嵌套联邦演示，被 shell 加载又内部加载 products/cart |
| server | 3001 | REST API + SQLite（users / products / cart_items / orders / order_items） |

另有 `/multi` 多实例页（shell 本地页面），同时装载多个 products/cart 实例。

## 快速开始

```bash
# 1. 安装所有依赖（根目录 + 各子项目）
npm run install:all

# 2. 初始化数据库 + 演示商品/用户
npm run seed

# 3. 构建所有微前端（Module Federation 需生成 remoteEntry.js，含 workspace）
npm run build

# 4. 一键启动全部 7 个服务（后端 + 6 个前端预览）
npm start
```

打开 http://localhost:5173 即可使用。

> 演示账号：`demo` / `demo123`（也可自行注册）

> **关于 `npm run dev`**：`@originjs/vite-plugin-federation` 的 remoteEntry.js 仅在 `build` 阶段生成，dev 模式下远程模块无法被宿主加载，因此推荐使用上面的 `build` + `start`（`vite preview`）方式运行。`npm run dev` 可用于单个应用独立开发调试。

## 技术要点

- **Module Federation**：使用 `@originjs/vite-plugin-federation`。每个 remote 在 `vite.config.js` 中 `exposes: { './App': './src/App.jsx' }`，shell 通过 `remotes` 引用各 remote 的 `remoteEntry.js`。
- **共享依赖**：`react` / `react-dom` / `react-router-dom` 通过 federation `shared` 单例化，因此各微前端可直接复用 shell 的 `BrowserRouter`，使用 `useNavigate` / `useLocation` / `Link`。
- **跨微前端通信**：`shared/bus.js` 是挂在 `window.__shopBus` 上的单例事件总线。购物车微前端修改后 `emit('cart:changed', count)`，shell 头部监听并更新角标；登录/登出通过 `auth:login` / `auth:logout` 事件同步。
- **鉴权**：JWT 存 `localStorage`，`shared/api.js` 自动附加 `Authorization` 头。
- **bootstrap 模式**：每个应用入口 `main.jsx` 动态 `import('./bootstrap.jsx')`，满足 Module Federation 的异步初始化要求。
- **嵌套联邦**：workspace 微前端同时配置 exposes 和 remotes，既是 shell 的 remote，又作为 host 加载 products/cart，形成 shell→workspace→products/cart 三层联邦。访问 /workspace 查看。
- **多实例**：shell 的 /multi 页用多个 Tab 同时装载同一子应用的多份实例（传不同 initialCategory 展示不同数据）+ 不同子应用实例，用 display:none 切换保留各自状态。子应用通过 embedded/initialCategory props 支持嵌入模式。

## 目录结构

```
mfe/
├── package.json            # 根编排（concurrently 一键启动）
├── shared/                 # 微前端共享：样式、API、事件总线
│   ├── styles.css
│   ├── api.js
│   └── bus.js
├── server/                 # 后端 Express + SQLite
│   └── src/{index,db,seed}.js + routes/
├── shell/                  # 主应用（host）
├── products/               # 商品微前端（remote）
├── cart/                   # 购物车微前端（remote）
├── auth/                   # 认证微前端（remote）
├── order/                  # 订单微前端（remote）
└── workspace/              # 工作台微前端（既是 remote 又是 host，嵌套联邦）
```
