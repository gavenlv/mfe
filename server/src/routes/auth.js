/**
 * 文件：server/src/routes/auth.js
 * 模块：认证路由（Auth Routes）
 * 核心职责：提供注册、登录、获取当前用户三个接口，负责签发和验证 JWT。
 *
 * 关键概念：
 *   - express.Router()：创建一个“子路由器”，把一组相关接口写在一起，
 *     最后由 index.js 用 app.use('/api/auth', authRouter) 挂到 /api/auth 前缀下。
 *     这里 router.post('/register', ...) 实际对应的就是 POST /api/auth/register。
 *   - JWT（JSON Web Token）登录流程：
 *       1) 用户注册/登录成功后，服务器用 jwt.sign(payload, secret, { expiresIn }) 签发一个 token，
 *          payload 里通常放用户 id、用户名等非敏感信息；
 *       2) 客户端把这个 token 存起来（localStorage / 内存），后续请求带上
 *          Authorization: Bearer <token> 头；
 *       3) 服务器用 jwt.verify(token, secret) 验签并取出 payload，从而识别用户身份。
 *     这是一种“无状态”登录：服务器不存 session，每次都靠验签识别用户，便于水平扩展。
 *   - HTTP 状态码：
 *       200/默认 表示成功；400 请求参数错误；401 未认证（密码错/未登录）；
 *       409 冲突（用户名已存在）。
 *   - SQL 占位符 ?：把用户输入当参数传给 .get/.run，绝不直接拼进 SQL 字符串，
 *     这是防止 SQL 注入的最基本做法。
 */

// 从 express 中解构出 Router 构造函数，用来创建子路由器
import { Router } from 'express';
// jsonwebtoken 用来签发（sign）和验证（verify）JWT
import jwt from 'jsonwebtoken';
// 引入共享的数据库连接
import db from '../db.js';
// 引入统一的 JWT 密钥，签发和验证必须用同一个，否则验证会失败
import { JWT_SECRET } from '../index.js';

// 创建一个子路由器实例，所有 router.xxx 都会挂到它上面
const router = Router();

// 注册
// 路径：POST /api/auth/register
// 用途：创建新账号并直接返回登录 token，省去注册后还要再登录一次
// 请求体：{ username, password, name? }
// 返回：{ token, user: { id, username, name } }
router.post('/register', (req, res) => {
  // 从请求体解构出字段；name 可选，没传时后面用 username 兜底
  const { username, password, name } = req.body;
  // 基本校验：用户名和密码必填，缺失返回 400（请求参数错误）
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  // 先查一下用户名是否已被占用；由于建表时 username 有 UNIQUE 约束，
  // 这里手动查主要是为了返回友好的 409 提示，而不是让数据库报错
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) {
    // 409 Conflict：资源冲突，表示用户名已存在
    return res.status(409).json({ error: '用户名已存在' });
  }
  // 插入新用户；name 没传就用 username 作为昵称
  // info.lastInsertRowid 是 better-sqlite3 提供的“刚插入那行的自增主键 id”
  const info = db.prepare('INSERT INTO users (username, password, name) VALUES (?, ?, ?)').run(
    username, password, name || username
  );
  // 用刚拿到的 id 再查一次，得到完整的用户信息（不含密码）返回给前端
  const user = db.prepare('SELECT id, username, name FROM users WHERE id = ?').get(info.lastInsertRowid);
  // 签发 JWT：payload 放 { id, username }，有效期 7 天
  // 前端拿到 token 后，每次请求带在 Authorization 头里即可识别身份
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

// 登录
// 路径：POST /api/auth/login
// 用途：用账号密码换取 JWT token
// 请求体：{ username, password }
// 返回：{ token, user: { id, username, name } }
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  // 用“用户名 + 密码”联合查询，命中即视为登录成功
  // 教学说明：这里用明文比对仅为演示，真实项目应存哈希并用 bcrypt.compare 校验
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
  if (!user) {
    // 401 Unauthorized：用户名或密码错误（不区分具体是哪个，避免被枚举探测）
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  // 登录成功同样签发一个 7 天有效的 token
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  // 注意返回给前端的 user 对象只挑了非敏感字段，不把 password 传出去
  res.json({ token, user: { id: user.id, username: user.username, name: user.name } });
});

// 获取当前用户
// 路径：GET /api/auth/me
// 用途：前端刷新页面后用本地 token 换取当前用户信息，实现“免登录保持登录态”
// 鉴权：通过 Authorization 头携带 token；无 token 或 token 失效则返回 { user: null }
// 返回：{ user: { id, username, name } | null }
router.get('/me', (req, res) => {
  // 本接口没有挂在全局 auth 中间件链路上，所以这里手动解析一次 Authorization 头
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  // 没有 token：直接告诉前端“当前未登录”
  if (!token) return res.json({ user: null });
  try {
    // 验签并取出 payload（里面有用户 id）
    const payload = jwt.verify(token, JWT_SECRET);
    // 根据 id 查库拿最新的用户信息
    const user = db.prepare('SELECT id, username, name FROM users WHERE id = ?').get(payload.id);
    res.json({ user });
  } catch {
    // token 非法或过期：当成未登录处理，返回 null，前端可据此跳回登录页
    res.json({ user: null });
  }
});

// 默认导出路由器，供 index.js 挂载
export default router;
