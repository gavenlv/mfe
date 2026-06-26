import db from './db.js';

const products = [
  { name: 'AirPods Pro 2', description: '主动降噪无线蓝牙耳机，空间音频体验。', price: 1899, image: '🎧', category: '数码', stock: 50, rating: 4.8 },
  { name: 'MacBook Air M3', description: '13 英寸轻薄笔记本，18 小时续航，强大性能。', price: 8999, image: '💻', category: '电脑', stock: 20, rating: 4.9 },
  { name: 'iPhone 15 Pro', description: '钛金属机身，A17 Pro 芯片，专业级摄像系统。', price: 7999, image: '📱', category: '手机', stock: 30, rating: 4.7 },
  { name: 'Apple Watch S9', description: '智能手表，健康监测，明亮显示屏。', price: 2999, image: '⌚', category: '穿戴', stock: 40, rating: 4.6 },
  { name: 'iPad Pro 12.9', description: 'M2 芯片，Liquid 视网膜 XDR 显示屏。', price: 8499, image: '📋', category: '平板', stock: 25, rating: 4.8 },
  { name: 'Magic Keyboard', description: '妙控键盘，带触控 ID，舒适打字体验。', price: 1099, image: '⌨️', category: '配件', stock: 80, rating: 4.5 },
  { name: 'HomePod mini', description: '小巧智能音箱，沉浸式空间音频。', price: 749, image: '🔊', category: '音频', stock: 60, rating: 4.4 },
  { name: 'Mac Studio', description: 'M2 Ultra 芯片，专业工作站级性能。', price: 16499, image: '🖥️', category: '电脑', stock: 10, rating: 4.9 },
  { name: 'Studio Display', description: '27 英寸 5K 视网膜显示屏，专业级色彩。', price: 11499, image: '🖼️', category: '配件', stock: 15, rating: 4.6 },
  { name: 'AirTag 四件套', description: '物品追踪器，精准查找，超宽频芯片。', price: 779, image: '🏷️', category: '配件', stock: 100, rating: 4.5 },
  { name: 'Pencil Pro', description: 'Apple Pencil Pro，侧旋、挤压手势触感反馈。', price: 949, image: '✏️', category: '配件', stock: 70, rating: 4.7 },
  { name: 'Vision Pro', description: '空间计算设备，革命性交互体验。', price: 29999, image: '🥽', category: '数码', stock: 5, rating: 4.9 },
];

const insert = db.prepare(`
  INSERT INTO products (name, description, price, image, category, stock, rating)
  VALUES (@name, @description, @price, @image, @category, @stock, @rating)
`);

const count = db.prepare('SELECT COUNT(*) as c FROM products').get();
if (count.c === 0) {
  const tx = db.transaction((items) => {
    for (const p of items) insert.run(p);
  });
  tx(products);
  console.log(`已插入 ${products.length} 个商品`);
} else {
  console.log(`数据库已有 ${count.c} 个商品，跳过种子`);
}

// 默认演示用户
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
if (userCount.c === 0) {
  db.prepare('INSERT INTO users (username, password, name) VALUES (?, ?, ?)').run('demo', 'demo123', '演示用户');
  console.log('已创建演示用户: demo / demo123');
}

console.log('种子完成');
