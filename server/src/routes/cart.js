/**
 * 文件：server/src/routes/cart.js
 * 模块：购物车路由（Cart Routes）
 * 核心职责：对“当前登录用户的购物车”做增删改查，包括查购物车、加购、改数量、删项、清空。
 *
 * 关键概念：
 *   - 鉴权：本路由所有接口都需要登录。index.js 中 /api/cart 已经先挂了 auth 中间件拿到 req.user，
 *     每个路由又额外挂了 requireAuth 强制登录，未登录会直接返回 401。
 *   - 用户隔离：所有 SQL 都带 WHERE user_id = ?，确保每个用户只能操作自己的购物车，
 *     不会查到/改到别人的数据。req.user.id 由 JWT 验签后得到，可信。
 *   - JOIN 联表查询：查购物车时要同时展示商品信息（名称、价格、图片、库存），
 *     而 cart_items 只存 user_id / product_id / quantity，所以用 JOIN 把 products 表连进来。
 *   - 联合唯一约束的妙用：建表时 cart_items 有 UNIQUE(user_id, product_id)，
 *     所以“再次加购同一商品”时不需要新插一行，而是 UPDATE 累加数量，避免重复项。
 *   - RESTful 设计：
 *       GET    /api/cart              -> 查购物车
 *       POST   /api/cart              -> 加入购物车
 *       PUT    /api/cart/:productId   -> 修改某商品数量（<=0 等同删除）
 *       DELETE /api/cart/:productId   -> 删除某购物车项
 *       DELETE /api/cart              -> 清空购物车
 */

// 从 express 解构出 Router，创建子路由器
import { Router } from 'express';
// 引入共享的数据库连接
import db from '../db.js';
// 引入“必须登录”中间件：未登录直接 401
import { requireAuth } from '../index.js';

// 创建子路由器实例
const router = Router();

// 获取购物车（带商品信息）
// 路径：GET /api/cart
// 用途：返回当前用户的购物车列表及总价
// 鉴权：必须登录（requireAuth）
// 返回：{ items: [...], total }
router.get('/', requireAuth, (req, res) => {
  // JOIN 查询：cart_items 别名为 c，products 别名为 p
  // 通过 c.product_id = p.id 把两张表连起来，一行同时拿到购物车项和商品信息
  // SELECT c.id, c.product_id AS productId ... 用 AS 给列起别名，让前端拿到的字段名更符合 JS 习惯（驼峰）
  const rows = db.prepare(`
    SELECT c.id, c.product_id AS productId, c.quantity, p.name, p.price, p.image, p.stock
    FROM cart_items c JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
  `).all(req.user.id);
  // 用 reduce 累加每行的“单价 × 数量”，得到购物车总价
  const total = rows.reduce((s, r) => s + r.price * r.quantity, 0);
  res.json({ items: rows, total });
});

// 添加商品到购物车
// 路径：POST /api/cart
// 用途：把指定商品加入购物车；若已在购物车则累加数量
// 请求体：{ productId, quantity?=1 }
// 鉴权：必须登录
// 返回：{ ok: true }
router.post('/', requireAuth, (req, res) => {
  // quantity 默认 1（解构时给默认值）
  const { productId, quantity = 1 } = req.body;
  // 先确认商品存在，避免把不存在的 product_id 塞进购物车
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: '商品不存在' });
  // 查这条 (用户, 商品) 在购物车里是否已存在
  const existing = db.prepare('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?').get(req.user.id, productId);
  if (existing) {
    // 已存在：在原数量基础上累加，而不是新插一行（这就是 UNIQUE 约束带来的简化）
    db.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id);
  } else {
    // 不存在：新插一条购物车项
    db.prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)').run(req.user.id, productId, quantity);
  }
  res.json({ ok: true });
});

// 更新数量
// 路径：PUT /api/cart/:productId
// 用途：把某商品在购物车里的数量设为指定值；若数量 <=0 视为删除该项
// 路径参数：productId
// 请求体：{ quantity }
// 鉴权：必须登录
// 返回：{ ok: true }
router.put('/:productId', requireAuth, (req, res) => {
  const { quantity } = req.body;
  if (quantity <= 0) {
    // 数量小于等于 0：等同于“不要这个商品了”，直接删掉这条购物车项
    db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, req.params.productId);
  } else {
    // 正常数量：更新为指定值
    db.prepare('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?').run(quantity, req.user.id, req.params.productId);
  }
  res.json({ ok: true });
});

// 删除购物车项
// 路径：DELETE /api/cart/:productId
// 用途：从购物车里移除某个商品（不论数量）
// 路径参数：productId
// 鉴权：必须登录
// 返回：{ ok: true }
router.delete('/:productId', requireAuth, (req, res) => {
  // 删除时同样带 user_id 限定，确保只能删自己的购物车项
  db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, req.params.productId);
  res.json({ ok: true });
});

// 清空购物车
// 路径：DELETE /api/cart
// 用途：清掉当前用户的所有购物车项（下单成功后通常会调用）
// 鉴权：必须登录
// 返回：{ ok: true }
router.delete('/', requireAuth, (req, res) => {
  // 只带 user_id 条件，删掉该用户的全部购物车记录
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

// 默认导出路由器，供 index.js 挂载到 /api/cart
export default router;
