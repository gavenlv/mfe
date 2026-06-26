/**
 * 文件：api.js
 * 所属模块：shared（所有微前端共用的接口请求与鉴权工具）
 * 核心职责：
 *   1. 封装与后端通信的统一请求函数 api()，自动带上 JWT token；
 *   2. 提供 token / user 的本地存取方法（基于 localStorage）。
 *
 * 关键概念——JWT 鉴权（前端侧）：
 *   JWT（JSON Web Token）是一种自包含的令牌。用户登录成功后，后端返回一个 token
 *   字符串，前端把它存到 localStorage。之后每次请求都把它放在
 *   `Authorization: Bearer <token>` 请求头里，后端校验通过即认定该用户身份。
 *   “token 存 localStorage”是最简单的实现，便于学习；但 localStorage 可被 JS 读取，
 *   存在 XSS 风险，生产环境更安全的做法是用 httpOnly cookie。
 *
 * 关键概念——为什么要统一封装 api()？
 *   各子应用都要调后端，如果各自写 fetch 会重复处理 token、JSON 序列化、错误信息。
 *   集中封装一次，所有微前端复用，既减少重复代码，又便于统一维护鉴权与错误处理。
 */

// 后端 API 封装（所有微前端共用）
// 后端服务地址：Express + SQLite，跑在 3001 端口
const BASE = 'http://localhost:3001/api';

// 读取本地存储的 token
export function getToken() {
  return localStorage.getItem('token');
}

// 登录成功后保存凭据：token 用来鉴权，user 用来在 UI 上显示用户信息
export function setAuth(token, user) {
  localStorage.setItem('token', token);
  // user 是对象，存之前要 JSON.stringify 转成字符串，localStorage 只能存字符串
  localStorage.setItem('user', JSON.stringify(user));
}

// 登出时清空凭据
export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// 读取并解析本地存储的 user 对象，解析失败时返回 null（不抛错）
export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

// GET 请求去重表（性能优化）：key = 请求路径，value = 进行中的 Promise。
// 场景：多实例页里 3 个 products 实例几乎同时挂载，各自调用 api('/products/categories')，
// 如果不去重会发 3 次一模一样的网络请求。去重后只发 1 次，3 个调用方共享同一个 Promise。
// 注意：只对“进行中”的请求去重，请求一结束（成功/失败）就删除条目，
//       之后再有相同 GET 仍会重新发起（不是永久缓存，避免拿到过期数据）。
const inflightGets = new Map();

// 统一请求函数：所有微前端都通过它访问后端
// path 是接口路径（如 '/products'），options 透传 method、body 等
export async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  // 仅对无 body 的 GET 请求做并发去重：POST/PUT/DELETE 是写操作，绝不能合并。
  const canDedupe = method === 'GET' && !options.body;
  // 已有相同 GET 在进行中：直接复用那个 Promise，不再发新请求
  if (canDedupe && inflightGets.has(path)) {
    return inflightGets.get(path);
  }

  // 真正发起请求的异步流程
  const run = (async () => {
    const token = getToken();
    // 组装请求头：默认 JSON 格式；有 token 时带上鉴权头；允许调用方覆盖 headers
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };
    const res = await fetch(BASE + path, {
      ...options,
      headers,
      // body 传的是对象，要序列化成 JSON 字符串；没 body 时设为 undefined
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    // 非 2xx 状态码视为失败，尝试从响应体取出错误信息后抛出
    if (!res.ok) {
      let msg = '请求失败';
      try {
        const err = await res.json();
        msg = err.error || msg;
      } catch {}
      throw new Error(msg);
    }
    // 204 No Content 没有响应体，直接返回 null，避免 res.json() 报错
    if (res.status === 204) return null;
    return res.json();
  })();

  // 对可去重的 GET：登记到表里，请求结束后清理（无论成功失败）
  if (canDedupe) {
    inflightGets.set(path, run);
    // finally 在 Promise 结束（resolve 或 reject）后执行，删除条目，
    // 让后续相同路径的 GET 能重新发起，拿到最新数据
    run.finally(() => inflightGets.delete(path));
  }
  return run;
}
