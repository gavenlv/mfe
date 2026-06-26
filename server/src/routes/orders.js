import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../index.js';

const router = Router();

// 创建订单（结算购物车）
router.post('/', requireAuth, (req, res) => {
  const { address, phone } = req.body;
  if (!address || !phone) return res.status(400).json({ error: '请填写收货地址和电话' });

  const items = db.prepare(`
    SELECT c.product_id, c.quantity, p.name, p.price, p.stock
    FROM cart_items c JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
  `).all(req.user.id);

  if (items.length === 0) return res.status(400).json({ error: '购物车为空' });

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const tx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO orders (user_id, total, status, address, phone)
      VALUES (?, ?, 'pending', ?, ?)
    `).run(req.user.id, total, address, phone);

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const it of items) {
      insertItem.run(info.lastInsertRowid, it.product_id, it.name, it.price, it.quantity);
      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(it.quantity, it.product_id);
    }
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
    return info.lastInsertRowid;
  });

  const orderId = tx();
  res.json({ ok: true, orderId });
});

// 获取订单列表
router.get('/', requireAuth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const itemsByOrder = {};
  for (const o of orders) {
    itemsByOrder[o.id] = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  }
  res.json(orders.map(o => ({ ...o, items: itemsByOrder[o.id] })));
});

// 订单详情
router.get('/:id', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.json({ ...order, items });
});

export default router;
