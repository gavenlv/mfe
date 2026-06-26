/**
 * 文件：server/src/routes/orders.js
 * 模块：订单路由（Order Routes）
 * 核心职责：提供“下单（结算购物车）、查订单列表、查订单详情”三个接口。
 *
 * 关键概念：
 *   - 鉴权：所有接口都需要登录。index.js 中 /api/orders 已挂 auth 中间件拿到 req.user，
 *     本文件每个路由再挂 requireAuth 强制登录。
 *   - 事务（Transaction）：下单是这个项目里最关键的写入操作，因为它要一次性完成四件事：
 *       1) 往 orders 表插一条订单主记录；
 *       2) 往 order_items 表插多条订单明细；
 *       3) 扣减 products 表里对应商品的库存；
 *       4) 清空当前用户的购物车。
 *     这四步必须“要么全部成功，要么全部回滚”，否则可能出现“扣了库存却没生成订单”
 *     或“生成了订单但购物车没清”等数据不一致问题。db.transaction(() => {...}) 正是为此而生：
 *     回调里任意一步抛错，之前已执行的所有写操作都会被撤销（回滚），保证数据一致性。
 *   - 订单项的冗余快照：order_items 里存了 product_name 和 price，因为商品信息日后可能修改/下架，
 *     但历史订单必须保留下单那一刻的名称和价格——所以下单时把当时的信息“快照”一份写进订单。
 *   - 用户隔离：所有查询都带 user_id 条件，用户只能看到/操作自己的订单。
 *   - RESTful 设计：
 *       POST /api/orders        -> 创建订单（结算购物车）
 *       GET  /api/orders        -> 当前用户的订单列表（每条带明细）
 *       GET  /api/orders/:id    -> 某条订单的详情（含明细）
 */

// 从 express 解构出 Router，创建子路由器
import { Router } from 'express';
// 引入共享的数据库连接
import db from '../db.js';
// 引入“必须登录”中间件
import { requireAuth } from '../index.js';

// 创建子路由器实例
const router = Router();

// 创建订单（结算购物车）
// 路径：POST /api/orders
// 用途：把当前用户购物车里的商品结算成一个订单：写订单 + 写明细 + 扣库存 + 清购物车
// 请求体：{ address, phone }
// 鉴权：必须登录
// 返回：{ ok: true, orderId }
router.post('/', requireAuth, (req, res) => {
  const { address, phone } = req.body;
  // 收货地址和电话必填，缺失返回 400
  if (!address || !phone) return res.status(400).json({ error: '请填写收货地址和电话' });

  // 先把当前用户购物车里的所有商品连表查出来，作为下单的依据
  // 同时拿到商品当前价格、库存，用于写明细和扣库存
  const items = db.prepare(`
    SELECT c.product_id, c.quantity, p.name, p.price, p.stock
    FROM cart_items c JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
  `).all(req.user.id);

  // 购物车是空的不能下单，返回 400
  if (items.length === 0) return res.status(400).json({ error: '购物车为空' });

  // 用购物车明细累加出订单总金额
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  // 用事务包裹整个下单过程：内部任一步失败，全部回滚，保证数据一致性（详见文件顶部说明）
  const tx = db.transaction(() => {
    // 1) 插入订单主记录，状态固定 'pending'（待处理）
    // info.lastInsertRowid 是新订单的自增 id
    const info = db.prepare(`
      INSERT INTO orders (user_id, total, status, address, phone)
      VALUES (?, ?, 'pending', ?, ?)
    `).run(req.user.id, total, address, phone);

    // 2) 预编译订单明细插入语句，循环里多次复用，更高效
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const it of items) {
      // 2a) 插一条订单明细（用下单时刻的商品名和价格做快照）
      insertItem.run(info.lastInsertRowid, it.product_id, it.name, it.price, it.quantity);
      // 2b) 扣减对应商品的库存
      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(it.quantity, it.product_id);
    }
    // 3) 清空当前用户的购物车（订单已生成，购物车里的东西转成了订单）
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
    // 把新订单 id 作为事务的返回值
    return info.lastInsertRowid;
  });

  // 执行事务，拿到新订单 id
  const orderId = tx();
  res.json({ ok: true, orderId });
});

// 获取订单列表
// 路径：GET /api/orders
// 用途：返回当前用户的所有订单，每个订单附带其明细列表
// 鉴权：必须登录
// 返回：订单数组，每条形如 { id, user_id, total, status, ..., items: [...] }
router.get('/', requireAuth, (req, res) => {
  // 查当前用户的所有订单，按创建时间倒序（最新在最前）
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  // 用一个对象把“订单 id -> 该订单的明细数组”缓存起来，避免在循环里重复查同样的数据
  const itemsByOrder = {};
  for (const o of orders) {
    // 查每个订单对应的明细行
    itemsByOrder[o.id] = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  }
  // 把明细数组挂到对应订单对象上一起返回
  res.json(orders.map(o => ({ ...o, items: itemsByOrder[o.id] })));
});

// 订单详情
// 路径：GET /api/orders/:id
// 用途：根据 id 查单个订单及其明细
// 路径参数：id（订单 id）
// 鉴权：必须登录，且只能查自己的订单
// 返回：订单对象（含 items）；不存在或不属于该用户则 404
router.get('/:id', requireAuth, (req, res) => {
  // 查询时同时带 id 和 user_id 两个条件：
  // 这样即使别人知道某个订单 id，也查不到不属于自己的订单（返回 404），起到权限隔离作用
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  // 查该订单的所有明细行
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  // 把明细合并进订单对象返回
  res.json({ ...order, items });
});

// 默认导出路由器，供 index.js 挂载到 /api/orders
export default router;
