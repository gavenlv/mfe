# 04 · 后端 API 与数据库设计

后端代码在 `server/`。技术栈：**Node.js + Express + better-sqlite3 + JWT**。无 ORM，直接写 SQL，最适合学习。

## 文件结构

```
server/
├── package.json
└── src/
    ├── index.js          # Express 应用入口、中间件、路由挂载
    ├── db.js             # SQLite 连接 + 建表
    ├── seed.js           # 灌入演示数据（商品 + demo 用户）
    └── routes/
        ├── auth.js       #   注册/登录/查当前用户
        ├── products.js   #   商品列表/详情/分类
        ├── cart.js       #   购物车增删改查
        └── orders.js     #   下单/订单列表/详情
```

## Express 是什么

Express 是 Node.js 上最经典的 Web 框架。核心思想：**中间件（middleware）链条**。

```js
const app = express();
app.use(cors());          // 中间件1：处理跨域
app.use(express.json());  // 中间件2：把请求体 JSON 解析成 req.body

app.get('/api/products', (req, res) => { ... });  // 路由：也是中间件
```

每个请求进来，依次穿过所有 `app.use` 注册的中间件，最后命中某个路由。中间件可以：
- 改造 `req` / `res`（如解析 body、注入 `req.user`）
- 决定是否 `next()` 放行给下一个
- 直接 `res.json()` 结束响应

本项目的 `auth` 中间件就是典型：它解析 JWT 把用户塞进 `req.user`，再 `next()`。

## CORS（跨域）

前端在 5173，后端在 3001，端口不同属于"跨域"。浏览器默认会拦截跨域请求。`app.use(cors())` 让后端在响应头加上 `Access-Control-Allow-Origin`，告诉浏览器"允许放行"。没有它，前端 fetch 后端会被浏览器拦截。

## 数据库表结构（5 张表）

`db.js` 里建表 SQL：

### users（用户）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK AUTOINCREMENT | 主键，自增 |
| username | TEXT UNIQUE | 登录名，唯一 |
| password | TEXT | 密码（Demo 明文存储，生产要哈希） |
| name | TEXT | 昵称 |
| created_at | TEXT | 注册时间 |

### products（商品）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| name / description | TEXT | 名称/描述 |
| price | REAL | 价格（浮点） |
| image | TEXT | 图片，这里存 emoji 当占位图 |
| category | TEXT | 分类 |
| stock | INTEGER | 库存 |
| rating | REAL | 评分 |

### cart_items（购物车项）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| user_id | INTEGER FK→users.id | 所属用户 |
| product_id | INTEGER FK→products.id | 商品 |
| quantity | INTEGER | 数量 |

关键约束：`UNIQUE(user_id, product_id)` —— 同一用户同一商品只有一行，重复加购就累加数量（见 cart 路由逻辑）。

### orders（订单主表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 订单号 |
| user_id | FK | 下单用户 |
| total | REAL | 总金额 |
| status | TEXT | 状态（pending/paid/shipped） |
| address / phone | TEXT | 收货信息 |
| created_at | TEXT | 下单时间 |

### order_items（订单明细）
| 字段 | 类型 | 说明 |
|------|------|------|
| order_id | FK→orders.id | 所属订单 |
| product_id | FK | 商品 |
| **product_name** | TEXT | 商品名快照 |
| **price** | REAL | 下单时价格快照 |
| quantity | INTEGER | 数量 |

> **为什么 order_items 要存 product_name 和 price 快照？** 因为商品的名称和价格以后会改。如果只存 product_id，将来商品改价后，老订单的总金额会跟着变，财务就错了。下单瞬间把价格"拍张照"存下来，订单就固定了。

## better-sqlite3 用法要点

```js
import Database from 'better-sqlite3';
const db = new Database('shop.db');

// 查多行
const rows = db.prepare('SELECT * FROM products WHERE category = ?').all('手机');

// 查一行
const row = db.prepare('SELECT * FROM products WHERE id = ?').get(1);

// 增删改（返回执行信息）
const info = db.prepare('INSERT INTO users (username,password) VALUES (?,?)')
                .run('demo','demo123');
info.lastInsertRowid;  // 新插入行的 id

// 预编译 + 命名占位符（防 SQL 注入）
const stmt = db.prepare('INSERT INTO products (name,price) VALUES (@name,@price)');
stmt.run({ name: '耳机', price: 199 });
```

要点：
- **同步 API**：没有 Promise，直接返回结果，代码好读
- **`?` 或 `@name` 占位符**：永远不要拼字符串进 SQL，防 SQL 注入
- **`prepare` 预编译**：同一条 SQL 多次执行时性能更好

## 事务（transaction）—— 下单的核心

`routes/orders.js` 下单时要做 4 件事，必须"要么全成功，要么全不做"：

```js
const tx = db.transaction(() => {
  // 1. 写订单主表
  const info = db.prepare('INSERT INTO orders ...').run(...);
  // 2. 写每个商品明细
  for (const it of items) db.prepare('INSERT INTO order_items ...').run(...);
  // 3. 扣库存
  db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(...);
  // 4. 清空购物车
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(...);
  return info.lastInsertRowid;
});
const orderId = tx();  // 任何一步抛错，整个事务回滚
```

如果不用事务：写完订单主表后程序崩了，库存没扣、购物车没清，数据就不一致了。事务保证原子性。

## REST API 一览

设计遵循 RESTful 风格：用 HTTP 方法区分操作，用 URL 表达资源。

| 方法 | 路径 | 鉴权 | 用途 |
|------|------|------|------|
| POST | /api/auth/register | 否 | 注册，返回 {token, user} |
| POST | /api/auth/login | 否 | 登录，返回 {token, user} |
| GET | /api/auth/me | 否 | 查当前用户（看 token） |
| GET | /api/products | 否 | 商品列表，支持 ?category=&q= |
| GET | /api/products/categories | 否 | 所有分类 |
| GET | /api/products/:id | 否 | 商品详情 |
| GET | /api/cart | 是 | 我的购物车 |
| POST | /api/cart | 是 | 加购 {productId, quantity} |
| PUT | /api/cart/:productId | 是 | 改数量 {quantity} |
| DELETE | /api/cart/:productId | 是 | 删除某项 |
| DELETE | /api/cart | 是 | 清空 |
| POST | /api/orders | 是 | 下单 {address, phone} |
| GET | /api/orders | 是 | 我的订单列表 |
| GET | /api/orders/:id | 是 | 订单详情 |

HTTP 方法语义：**GET 查、POST 增、PUT 改、DELETE 删**。状态码：200 成功、400 参数错、401 未登录、404 不存在、409 冲突（如用户名已存在）。

## JWT 鉴权全流程

JWT（JSON Web Token）是一种无状态的登录方案。"无状态"指服务器不存 session，全靠 token 认人。

### 1. 登录签发（routes/auth.js）

```js
const token = jwt.sign(
  { id: user.id, username: user.username },  // 载荷：放什么都能认人
  JWT_SECRET,                                  // 密钥，只有服务器知道
  { expiresIn: '7d' }                          // 7 天后过期
);
res.json({ token, user });
```

token 长这样：`xxxxx.yyyyy.zzzzz`（三段，用 . 分隔，是 base64 编码 + 签名）。

### 2. 前端携带（shared/api.js）

前端拿到 token 存进 `localStorage`，之后每次请求加请求头：

```
Authorization: Bearer eyJhbGciOi...
```

`api()` 封装会自动加这个头。

### 3. 后端验证（index.js 的 auth 中间件）

```js
export function auth(req, res, next) {
  const token = (req.headers.authorization || '').slice(7);  // 去掉 "Bearer "
  if (!token) { req.user = null; return next(); }            // 没登录也放行
  try {
    req.user = jwt.verify(token, JWT_SECRET);  // 验签 + 解析，得到 {id,username}
    next();
  } catch {
    req.user = null; next();                    // token 无效当未登录
  }
}
```

`requireAuth` 中间件则在 `req.user` 为空时返回 401，用于必须登录的路由（购物车、订单）。

### 为什么用 JWT 不用 session

- 服务器不用存登录态，多实例部署天然兼容（任何一台都能验）
- 前端存哪都行（localStorage / cookie），跨域方便
- 适合前后端分离 + 微前端

> Demo 简化了：密码明文存、token 不刷新、密钥硬编码。生产要哈希密码、用环境变量存密钥、考虑 refresh token。

下一章 → [05 · 微前端通信与状态同步](./05-微前端通信与状态同步.md)
