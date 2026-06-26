import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../index.js';

const router = Router();

// 获取购物车（带商品信息）
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.product_id AS productId, c.quantity, p.name, p.price, p.image, p.stock
    FROM cart_items c JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
  `).all(req.user.id);
  const total = rows.reduce((s, r) => s + r.price * r.quantity, 0);
  res.json({ items: rows, total });
});

// 添加商品到购物车
router.post('/', requireAuth, (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: '商品不存在' });
  const existing = db.prepare('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?').get(req.user.id, productId);
  if (existing) {
    db.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id);
  } else {
    db.prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)').run(req.user.id, productId, quantity);
  }
  res.json({ ok: true });
});

// 更新数量
router.put('/:productId', requireAuth, (req, res) => {
  const { quantity } = req.body;
  if (quantity <= 0) {
    db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, req.params.productId);
  } else {
    db.prepare('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?').run(quantity, req.user.id, req.params.productId);
  }
  res.json({ ok: true });
});

// 删除购物车项
router.delete('/:productId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, req.params.productId);
  res.json({ ok: true });
});

// 清空购物车
router.delete('/', requireAuth, (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

export default router;
