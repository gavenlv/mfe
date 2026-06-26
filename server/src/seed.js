/**
 * 文件：server/src/seed.js
 * 模块：数据库种子脚本（Database Seeder）
 * 核心职责：
 *   1. 在空数据库里插入一批“示例商品”，方便前端开发时直接有数据可看；
 *   2. 创建一个演示用户 demo / demo123，方便登录测试；
 *   3. 已有数据时跳过，保证可重复运行而不会插重复数据。
 *
 * 关键概念：
 *   - 种子（Seed）：给空数据库填入初始/演示数据的过程。区别于“建表（schema）”只定义结构，
 *     种子负责填入“内容”。通常只在开发环境运行。
 *   - 预编译语句（prepared statement）：db.prepare(sql) 会先把 SQL 编译好，
 *     之后多次 .run(...) 只需传参即可，比每次都重新解析 SQL 更快，还能防 SQL 注入。
 *   - 命名参数（@name）：better-sqlite3 支持用 @name 形式的命名占位符，
 *     传参时直接给一个对象 { name, price, ... }，可读性更好，也不依赖顺序。
 *   - 事务（transaction）：把多条写入打包成“要么全部成功，要么全部回滚”的原子操作。
 *     这里插 12 个商品用事务包裹，中途任意一条失败，前面的插入也会被撤销，避免出现半截数据。
 *   - 幂等性：通过先 SELECT COUNT(*) 判断是否已有数据，做到“跑多少次结果都一样”，
 *     不会因为重复执行而插出重复商品。
 */

// 引入共享的数据库连接实例（db.js 里 new 出来的那个）
import db from './db.js';

// 一份示例商品清单，作为演示数据；image 字段用 emoji 充当图标，省去图片资源
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

// 预编译一条插入语句，使用 @name 命名占位符，参数由后续 insert.run(对象) 传入
// 注意：@xxx 必须和下面对象的 key 一一对应
const insert = db.prepare(`
  INSERT INTO products (name, description, price, image, category, stock, rating)
  VALUES (@name, @description, @price, @image, @category, @stock, @rating)
`);

// 先查询当前 products 表里已有多少条数据
// .get() 返回第一行，结果形如 { c: 0 } 或 { c: 12 }
const count = db.prepare('SELECT COUNT(*) as c FROM products').get();
if (count.c === 0) {
  // 表是空的：用事务把 12 个商品一次性插入，保证原子性
  // db.transaction(fn) 返回一个新函数，调用它时 fn 内部的所有 DB 操作会作为一个事务执行
  const tx = db.transaction((items) => {
    for (const p of items) insert.run(p);
  });
  tx(products);
  console.log(`已插入 ${products.length} 个商品`);
} else {
  // 已有数据：跳过，避免重复插入，保持脚本幂等
  console.log(`数据库已有 ${count.c} 个商品，跳过种子`);
}

// 默认演示用户
// 同样先查 users 表是否为空，避免重复创建 demo 账号
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
if (userCount.c === 0) {
  // 这里用 ? 位置占位符（按顺序传入），插入一条 demo 用户
  // 教学说明：密码明文存储仅用于演示，真实项目必须用 bcrypt 等算法做哈希后再存
  db.prepare('INSERT INTO users (username, password, name) VALUES (?, ?, ?)').run('demo', 'demo123', '演示用户');
  console.log('已创建演示用户: demo / demo123');
}

console.log('种子完成');
