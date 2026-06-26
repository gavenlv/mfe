/**
 * 文件：server/src/index.js
 * 模块：后端应用入口（Application Entry）
 * 核心职责：
 *   1. 创建并配置一个 Express 服务器实例；
 *   2. 注册全局中间件（CORS、JSON 解析）；
 *   3. 定义鉴权中间件 auth / requireAuth，并把各业务路由挂载到 /api/* 路径下；
 *   4. 监听端口，对外提供 HTTP 服务。
 *
 * 关键概念：
 *   - Express：Node.js 上最流行的 Web 框架。它把 HTTP 请求抽象成一条“中间件流水线”，
 *     每个中间件是一个 (req, res, next) => {} 函数，可以读取/修改请求、结束响应，
 *     或调用 next() 把控制权交给下一个中间件。app.use() 就是往流水线上挂一个中间件。
 *   - 路由（Router）：把同一组相关的接口（比如 /api/products 下的列表、详情、分类）
 *     收拢到一个“迷你应用”里，最后用 app.use('/api/products', productsRouter) 统一挂载。
 *   - RESTful API：用 HTTP 方法表达意图——GET 查询、POST 新增、PUT 修改、DELETE 删除，
 *     用 URL 表达资源，用状态码（200/400/401/404/409）表达结果。
 *   - JWT（JSON Web Token）：无状态登录方案，登录后服务器签发一个带签名的 token，
 *     客户端后续请求把它放在 Authorization: Bearer <token> 头里，服务器验签即可识别用户，
 *     不需要在服务端存 session。
 */

// express 是 Node.js 的 Web 框架，这里默认导出的就是创建应用的工厂函数
import express from 'express';
// cors 中间件用来给响应加上允许跨域的头；浏览器同源策略会拦截跨域请求，后端必须显式放行
import cors from 'cors';
// jsonwebtoken 用来签发和验证 JWT（登录令牌）
import jwt from 'jsonwebtoken';
// 下面四个是业务路由模块，每个文件导出一个 express.Router()，由这里统一挂载
import productsRouter from './routes/products.js';
import cartRouter from './routes/cart.js';
import authRouter from './routes/auth.js';
import ordersRouter from './routes/orders.js';

// 调用 express() 创建一个应用实例 app，后续所有配置都挂在它上面
const app = express();
// 后端监听的端口号；前端通过 http://localhost:3001/api/* 访问
const PORT = 3001;
// JWT 的签名密钥。token 是用这个密钥“签名”的，验证时也要用同一个密钥，
// 这样只要密钥不泄露，别人就无法伪造合法 token。导出供路由模块复用。
// 注意：真实项目应放到环境变量里，不要写死在代码中，这里仅为教学演示。
export const JWT_SECRET = 'shop-mfe-secret-2024';

// 全局启用 CORS：允许任意前端域名跨域访问本后端
// 原理：浏览器对“跨域请求”会先检查响应头里有没有 Access-Control-Allow-Origin，
// cors() 会自动加上这些允许跨域的头，否则前端 fetch 会被浏览器拦截并报 CORS 错误。
app.use(cors());
// 解析 JSON 请求体：前端用 fetch 发 JSON 时，Content-Type: application/json，
// 这一行会把 req.body 从原始字节解析成 JS 对象，路由里才能用 req.body.username 等
app.use(express.json());

// 鉴权中间件：从 Authorization 头解析 token
// 这是一个“软鉴权”：无论是否登录都放行，但会把解析出来的用户信息挂到 req.user 上
// 没登录时 req.user 为 null，登录了 req.user 就是 { id, username, ... }
export function auth(req, res, next) {
  // Authorization 头格式约定为 "Bearer <token>"，没有就是空字符串
  const header = req.headers.authorization || '';
  // 去掉前缀 "Bearer "（共 7 个字符），剩下的才是真正的 token
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    // 没有 token：标记为未登录，继续往下走（让后续中间件/路由自己决定要不要拒绝）
    req.user = null;
    return next();
  }
  try {
    // jwt.verify 用密钥验签并解码 token，得到当初签发时放进去的 payload（用户信息）
    // 如果 token 被篡改过、或已过期，会抛异常跳到 catch
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    // token 非法或过期：当成未登录处理，不报错，继续放行
    req.user = null;
    next();
  }
}

// 必须登录的中间件
// 在需要登录才能访问的路由上使用：若 auth 中间件解析后 req.user 仍为空，就直接返回 401
// 401 Unauthorized 表示“未认证”，告诉前端需要先登录
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: '未登录' });
  }
  next();
}

// 把各业务路由挂载到对应前缀下：
// - /api/auth    -> 注册、登录、获取当前用户
// - /api/products -> 商品列表、分类、详情（无需登录即可浏览）
// - /api/cart    -> 购物车增删改查，先经过 auth 软鉴权拿用户信息
// - /api/orders  -> 订单创建、列表、详情，同样先经过 auth
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/cart', auth, cartRouter);
app.use('/api/orders', auth, ordersRouter);

// 健康检查接口：前端/运维可用来探测后端是否存活，固定返回 { ok: true }
app.get('/api/health', (req, res) => res.json({ ok: true }));

// 启动 HTTP 服务，开始监听 PORT 端口；监听成功后执行回调打印日志
app.listen(PORT, () => {
  console.log(`🛒 商城后端运行于 http://localhost:${PORT}`);
});
