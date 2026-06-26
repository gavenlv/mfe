/**
 * 文件：server/src/db.js
 * 模块：数据库连接与建表（Database Setup）
 * 核心职责：
 *   1. 创建一个 SQLite 数据库连接（better-sqlite3）；
 *   2. 打开 WAL 模式、开启外键约束；
 *   3. 用 CREATE TABLE IF NOT EXISTS 定义所有业务表结构；
 *   4. 默认导出 db 实例，供其它模块复用同一个连接。
 *
 * 关键概念：
 *   - SQLite：一个文件就是一个数据库（这里是 server/shop.db），无需单独安装数据库服务，
 *     非常适合教学和小型项目。better-sqlite3 是它的 Node.js 驱动。
 *   - better-sqlite3 用“同步 API”：调用完才返回，代码读起来像同步顺序执行，简单直观；
 *     因为 SQLite 本身是本地文件操作、很快，且 Node 单线程下同步操作不会被打断，所以这样用没问题。
 *   - pragma：SQLite 特有的“配置指令”，用来设置数据库行为，比如 journal_mode、foreign_keys。
 *   - WAL（Write-Ahead Logging）：一种日志模式，写入先记到日志文件再合并回主库，
 *     能让“读”和“写”并发进行，提升性能，是 SQLite 推荐的生产配置。
 *   - 外键（FOREIGN KEY）：让一张表的某列必须引用另一张表已存在的主键，
 *     比如 cart_items.user_id 必须是 users 表里真实存在的 id，保证数据一致性。
 *   - ESM：本工程使用 ES Modules（import/export）。ESM 中没有 CommonJS 的 __dirname，
 *     需要用 import.meta.url + fileURLToPath + dirname 自行算出当前文件所在目录。
 */

// better-sqlite3 默认导出一个构造函数，new Database(path) 即打开/创建一个 .db 文件
import Database from 'better-sqlite3';
// fileURLToPath 把 file:///... 形式的 URL 转成普通磁盘路径，ESM 里 import.meta.url 就是这种 URL
import { fileURLToPath } from 'url';
// dirname 取路径的目录部分，join 把多段路径拼成一个完整路径（自动处理分隔符）
import { dirname, join } from 'path';

// ESM 下手动计算 __dirname：
// import.meta.url -> 当前文件的 file:// URL
// fileURLToPath   -> 转成磁盘路径，例如 .../server/src/db.js
// dirname         -> 取目录，得到 .../server/src
const __dirname = dirname(fileURLToPath(import.meta.url));
// 数据库文件放在 server 目录下（src 的上一层），文件名 shop.db
const dbPath = join(__dirname, '..', 'shop.db');

// 打开数据库连接；文件不存在会自动创建。整个应用共用这一个 db 实例
const db = new Database(dbPath);
// 启用 WAL 日志模式：让读写可并发，提升性能（详见文件顶部说明）
db.pragma('journal_mode = WAL');
// 开启外键约束：SQLite 默认是关闭的，必须显式打开，FOREIGN KEY 才会真正生效
db.pragma('foreign_keys = ON');

// Schema：定义所有表的建表语句
// CREATE TABLE IF NOT EXISTS 表示“表不存在才创建，已存在则跳过”，避免重复运行时报错
db.exec(`
  -- 用户表：存登录账号信息
  -- INTEGER PRIMARY KEY AUTOINCREMENT：主键是整数，由数据库自动递增（1,2,3...）
  -- UNIQUE：该列值不能重复，这里用来保证用户名唯一，注册时重复会触发约束
  -- NOT NULL：该列不允许为空
  -- datetime('now')：SQLite 内置函数，返回当前时间字符串，作为默认值
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- 商品表：存商城里售卖的商品
  -- REAL 表示浮点数，用于价格、评分；INTEGER 用于库存
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    image TEXT,
    category TEXT,
    stock INTEGER DEFAULT 100,
    rating REAL DEFAULT 4.5,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- 购物车项表：一个用户可以有多条购物车记录，每条对应一个商品及其数量
  -- UNIQUE(user_id, product_id)：联合唯一约束，同一用户对同一商品只允许有一条购物车记录，
  --   这样“再次加入购物车”时可以用 UPDATE 累加数量，而不是 INSERT 出重复行
  -- FOREIGN KEY ... REFERENCES：外键，指向 users / products 的主键，保证关联的对象一定存在
  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    UNIQUE(user_id, product_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  -- 订单表：一次“下单”生成一条订单主记录，存总额、状态、收货信息
  -- status 用 TEXT 存状态字符串，默认 'pending'（待处理）
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    address TEXT,
    phone TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- 订单项表：订单的明细行，一个订单包含多个订单项（每项 = 某商品 + 数量 + 下单时的单价）
  -- 这里特意冗余存了 product_name 和 price：因为商品信息日后可能修改/下架，
  -- 但历史订单应该保留下单那一刻的名称和价格，所以下单时“快照”一份写进来
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

// 默认导出 db，其它模块 import db from './db.js' 即可拿到同一个连接
export default db;
