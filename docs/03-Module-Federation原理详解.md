# 03 · Module Federation 原理详解

这是本项目最核心的一章。读懂它，你就懂了微前端。

## 一句话理解

> Module Federation（模块联邦）让一个前端应用可以在**浏览器运行时**，去加载并运行**另一个独立部署的前端应用**里的某个模块，就像 import 本地文件一样。

## 两个角色

| 角色 | 本项目对应 | 做什么 |
|------|-----------|--------|
| **Host（宿主）** | shell | 主动去"引用"别人的模块 |
| **Remote（远程）** | products / cart / auth / order | 把自己的模块"暴露"给别人用 |

一个应用可以同时是 Host 和 Remote（shell 也可以暴露模块），本项目里 shell 只做 Host。

## 三个核心配置

### 1. `exposes`（Remote 端：暴露什么）

以 `products/vite.config.js` 为例：

```js
federation({
  name: 'productsApp',              // 这个 Remote 的名字
  filename: 'remoteEntry.js',       // 生成的入口清单文件名
  exposes: {
    './App': './src/App.jsx'        // 对外暴露的"虚拟路径" → 实际文件
  },
  shared: ['react', 'react-dom', 'react-router-dom']
})
```

含义：`productsApp` 这个应用对外提供一个叫 `./App` 的模块，它实际指向 `src/App.jsx`。构建后会生成 `dist/assets/remoteEntry.js`。

### 2. `remotes`（Host 端：引用谁）

`shell/vite.config.js`：

```js
federation({
  name: 'shell',
  remotes: {
    productsApp: 'http://localhost:5174/assets/remoteEntry.js',
    cartApp:     'http://localhost:5175/assets/remoteEntry.js',
    authApp:     'http://localhost:5176/assets/remoteEntry.js',
    orderApp:    'http://localhost:5177/assets/remoteEntry.js'
  },
  shared: ['react', 'react-dom', 'react-router-dom']
})
```

含义：shell 声明"我要用 4 个远程应用，它们的入口清单分别在哪些 URL"。注意 **Host 不需要知道 Remote 暴露了哪些模块**，运行时按需查清单。

### 3. `shared`（双方：共享依赖）

```js
shared: ['react', 'react-dom', 'react-router-dom']
```

含义：这几个依赖"可共享"。运行时，**先加载的那一份会被全局缓存**，后面谁要用就复用这一份，不再重复下载。

> 为什么必须共享 react？如果 shell 一份 react、products 一份 react，products 里调 `useState` 用的是自己的 react 实例，和 shell 的 react 不是同一个，会导致 hooks 报错、上下文丢失。共享后只有一份，天下太平。`react-router-dom` 同理——所以微前端才能复用 shell 的 `BrowserRouter`。

## Host 怎么用 Remote 的模块

`shell/src/App.jsx`：

```jsx
// 像动态 import 本地模块一样，只是路径变成 "远程名/暴露路径"
const ProductsApp = lazy(() => import('productsApp/App'));

// 用 Suspense 包裹，加载期间显示"加载中…"
<Suspense fallback={<div>加载中…</div>}>
  <ProductsApp />
</Suspense>
```

`import('productsApp/App')` 在浏览器里会发生：

1. 解析出 `productsApp` 对应的 remoteEntry.js URL
2. 下载 `http://localhost:5174/assets/remoteEntry.js`（很小的清单文件）
3. 清单告诉它 `./App` 实际对应哪个 chunk，再去下载那个 chunk
4. 执行该 chunk，拿到 App 组件
5. 这期间 react 等依赖复用 shell 已加载的版本

整个过程对使用者透明，写法和本地组件几乎一样。

## 为什么需要 bootstrap.jsx（异步边界）

每个应用的入口都拆成两个文件：

`src/main.jsx`：
```jsx
import('./bootstrap.jsx');   // 动态 import
```

`src/bootstrap.jsx`：
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
ReactDOM.createRoot(...).render(<App />);
```

**为什么不直接在 main.jsx 里写渲染逻辑？** 因为 Module Federation 的 `shared` 依赖需要**异步初始化**——它要先去检查"react 有没有人加载过？要不要复用？"，这是一个异步过程。

如果入口是同步执行的，代码会立刻用到 `react`，但此时共享依赖还没初始化好，就会报错。把真正用 react 的代码放进 `bootstrap.jsx`，再用 `import()` 动态引入，就制造了一个**异步边界**：等到 `bootstrap` 真正执行时，共享依赖已经准备好了。

> 这是 Module Federation 的硬性要求，Host 和 Remote 都要这么做。记住口诀：**"main 动态 import bootstrap"**。

## remoteEntry.js 是什么

构建后每个 Remote 在 `dist/assets/` 下生成 `remoteEntry.js`。它是一个很小的 JS 文件，作用类似"目录"：

- 声明本 Remote 暴露了哪些模块（`./App`）
- 声明本 Remote 依赖/提供哪些 shared（react 等）
- 提供运行时 API：`init()`（初始化共享作用域）和 `get(module)`（按需取模块）

Host 加载它后，就能按需获取 Remote 的任意已暴露模块。

## 为什么必须 build 才能跑

`vite-plugin-federation` 的 remoteEntry.js **只在 `vite build` 阶段生成**。Vite 的 dev 模式（`vite`）不会产出这个文件，dev server 对任何不存在的路径都返回 `index.html`（SPA 兜底），所以 Host 在 dev 下拉到的 remoteEntry.js 其实是 HTML，加载必失败。

因此本项目运行方式是：

```bash
npm run build     # 构建所有 5 个前端，各自生成 remoteEntry.js
npm start         # 用 vite preview 把每个 dist 跑起来
```

`vite preview` 会把 `dist` 当静态站点提供，`/assets/remoteEntry.js` 就是真实文件，Host 能正常加载。

> 单独开发某个微前端时，可以用 `npm run dev`（端口能独立跑起来看 UI），只是没法被 Host 联调。

## 一个完整的 Remote 配置模板

```js
// products/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'productsApp',                    // Remote 唯一标识
      filename: 'remoteEntry.js',             // 入口清单文件名
      exposes: { './App': './src/App.jsx' },  // 暴露的模块
      shared: ['react', 'react-dom', 'react-router-dom']  // 共享依赖
    })
  ],
  build: {
    target: 'esnext',      // 用最新 JS 语法，联邦需要
    cssCodeSplit: false    // CSS 不拆分，避免样式加载顺序问题
  },
  server: { port: 5174, strictPort: true }  // 固定端口
});
```

Host 配置只多了 `remotes`，少了 `exposes`。对照 `shell/vite.config.js` 看。

## 小结

| 概念 | 一句话 |
|------|--------|
| Module Federation | 运行时跨应用加载模块 |
| Host / Remote | 加载方 / 被加载方 |
| exposes | Remote 声明"我提供什么" |
| remotes | Host 声明"我用谁" |
| shared | 公共依赖只加载一份 |
| remoteEntry.js | Remote 的模块清单 |
| bootstrap 异步边界 | 让 shared 初始化完成后再用 react |

下一章 → [04 · 后端 API 与数据库设计](./04-后端-API-与数据库设计.md)
