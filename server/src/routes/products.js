import { Router } from 'express';
import db from '../db.js';

const router = Router();

// 商品列表（支持分类筛选和搜索）
router.get('/', (req, res) => {
  const { category, q } = req.query;
  let sql = 'SELECT * FROM products';
  const conditions = [];
  const params = [];
  if (category && category !== 'all') {
    conditions.push('category = ?');
    params.push(category);
  }
  if (q) {
    conditions.push('(name LIKE ? OR description LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// 所有分类
router.get('/categories', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
  res.json(rows.map(r => r.category));
});

// 商品详情
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '商品不存在' });
  res.json(row);
});

export default router;
