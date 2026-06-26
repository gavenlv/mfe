/**
 * 文件：server/src/routes/products.js
 * 模块：商品路由（Product Routes）
 * 核心职责：提供商品列表（支持分类筛选和搜索）、所有分类、商品详情三个只读接口。
 *
 * 关键概念：
 *   - 这组接口是“公开”的，不需要登录即可浏览商品（index.js 中 /api/products 没挂 auth）。
 *   - RESTful 设计：
 *       GET /api/products            -> 商品列表（可带 ?category=xx&q=xx 查询参数）
 *       GET /api/products/categories -> 所有分类
 *       GET /api/products/:id        -> 某个商品的详情
 *   - 查询参数（req.query）：GET 请求的参数跟在 URL 的 ? 后面，如 ?category=数码&q=air，
 *     Express 会自动解析成 req.query = { category: '数码', q: 'air' }。
 *   - 路径参数（req.params）：如 /api/products/3 中的 3，路由写成 /:id，取值用 req.params.id。
 *   - 动态拼接 SQL 的安全做法：列名/关键字用代码拼接，用户输入的“值”一律用 ? 占位符传入，
 *     既能支持灵活筛选，又能防止 SQL 注入。
 *   - LIKE 模糊查询：% 匹配任意字符，'%air%' 表示“名字或描述里包含 air”。
 */

// 从 express 解构出 Router，用来定义本模块的子路由
import { Router } from 'express';
// 引入共享的数据库连接
import db from '../db.js';

// 创建子路由器实例
const router = Router();

// 商品列表（支持分类筛选和搜索）
// 路径：GET /api/products
// 用途：返回商品列表，可按分类过滤、按关键字搜索，按创建时间倒序
// 查询参数：category（分类名，'all' 或不传表示全部）、q（搜索关键字）
// 鉴权：无（公开浏览）
// 返回：商品对象数组
router.get('/', (req, res) => {
  // 从查询串里取出 category 和 q（可能为 undefined）
  const { category, q } = req.query;
  // 基础 SQL：查所有商品；后续根据条件动态追加 WHERE
  let sql = 'SELECT * FROM products';
  // 用数组收集条件和参数：条件拼进 SQL，参数用 ? 传入，避免注入
  const conditions = [];
  const params = [];
  if (category && category !== 'all') {
    // 指定了分类且不是 'all'：追加 category = ? 条件
    conditions.push('category = ?');
    params.push(category);
  }
  if (q) {
    // 有关键字：在 name 和 description 上做 LIKE 模糊匹配
    // %${q}% 表示关键字前后都允许有任意字符，即“包含 q”
    conditions.push('(name LIKE ? OR description LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  // 如果有条件，就把它们用 AND 连起来追加到 WHERE 子句
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  // 按创建时间倒序排列：新商品排在前面
  sql += ' ORDER BY created_at DESC';
  // .all(...params) 执行查询并返回所有匹配行；展开参数数组按顺序填入 ? 占位符
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// 所有分类
// 路径：GET /api/products/categories
// 用途：返回去重后的所有分类名，供前端做分类筛选 tab
// 返回：字符串数组，如 ['数码', '电脑', '手机', ...]
router.get('/categories', (req, res) => {
  // SELECT DISTINCT category：对 category 列去重，只返回每种分类一次
  // ORDER BY category：按分类名字母/笔画顺序排好，前端展示更稳定
  const rows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
  // 数据库返回的是 [{ category: '数码' }, ...]，这里 map 成 ['数码', ...] 纯字符串数组
  res.json(rows.map(r => r.category));
});

// 商品详情
// 路径：GET /api/products/:id
// 用途：根据 id 查单个商品的详细信息
// 路径参数：id（商品 id）
// 返回：商品对象；不存在则 404
router.get('/:id', (req, res) => {
  // req.params.id 取自 URL 中的 :id；.get() 命中返回一行，否则返回 undefined
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  // 没查到：返回 404 Not Found
  if (!row) return res.status(404).json({ error: '商品不存在' });
  res.json(row);
});

// 默认导出路由器，供 index.js 挂载到 /api/products
export default router;
