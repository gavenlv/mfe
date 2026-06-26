/**
 * 文件：Header.jsx
 * 所属模块：shell（主应用顶部导航栏组件）
 * 核心职责：
 *   1. 渲染 Logo、主导航链接、购物车入口、登录/用户信息区；
 *   2. 通过事件总线订阅购物车变化、登录、登出事件，保持 UI 与全局状态同步；
 *   3. 首次挂载时从 localStorage 恢复登录用户、并向后端请求初始购物车数量。
 *
 * 关键概念：
 * - useState：声明组件内部状态（cartCount、user）。状态变化会触发组件重新渲染。
 * - useEffect：处理“副作用”（订阅事件、发请求、读写 localStorage）。
 *   返回的清理函数会在组件卸载时执行，用来取消订阅，避免内存泄漏。
 * - JWT 鉴权（前端侧）：登录后把 token 存到 localStorage，每次请求带在
 *   Authorization: Bearer <token> 头里；登出时清掉 token。注意 localStorage
 *   是浏览器本地存储，token 放这里有 XSS 风险，真实项目常用 httpOnly cookie。
 * - useNavigate：react-router-dom 提供的编程式跳转 API，可在事件处理里跳页。
 */

// useEffect：副作用钩子；useState：状态钩子
import { useEffect, useState } from 'react';
// Link：渲染为 <a> 但不刷新页面的路由链接；
// NavLink：会自动给“当前匹配的链接”加 active 类名，适合导航栏高亮；
// useNavigate：获取编程式跳转函数。
import { Link, NavLink, useNavigate } from 'react-router-dom';
// 主应用的事件总线与事件名常量（见 ../bus.js）
import { bus, EVENTS } from '../bus.js';

// 顶部导航栏组件：购物车角标和用户信息会随事件总线消息实时更新
export default function Header() {
  // cartCount：购物车里商品总件数，显示在购物车图标右上角的红点
  const [cartCount, setCartCount] = useState(0);
  // user：当前登录用户对象，未登录时为 null
  const [user, setUser] = useState(null);
  // navigate：用于在登出后跳回首页
  const navigate = useNavigate();

  // 这个 useEffect 只在组件首次挂载时运行一次（依赖数组为空 []）
  useEffect(() => {
    // 从 localStorage 恢复用户
    // 页面刷新后 React 状态会丢失，但 localStorage 不会，所以用它在刷新后恢复登录态
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));

    // 订阅购物车变化：子应用加购/改数量时会 emit 该事件，这里更新角标数字
    const offCart = bus.on(EVENTS.CART_CHANGED, (count) => setCartCount(count));
    // 订阅登录事件：认证子应用登录成功后 emit，主应用更新用户并持久化
    const offLogin = bus.on(EVENTS.LOGIN, (u) => {
      setUser(u);
      localStorage.setItem('user', JSON.stringify(u));
    });
    // 订阅登出事件：清空内存中的用户和本地存储的凭据
    const offLogout = bus.on(EVENTS.LOGOUT, () => {
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    });

    // 拉取初始购物车数量
    fetchCartCount();

    // 清理函数：组件卸载时取消所有订阅，避免重复监听与内存泄漏
    return () => {
      offCart();
      offLogin();
      offLogout();
    };
  }, []);

  // 向后端请求当前用户的购物车商品总件数
  async function fetchCartCount() {
    // 没登录就没有 token，直接返回（未登录用户不显示购物车数量）
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('http://localhost:3001/api/cart', {
        // JWT 鉴权：把 token 放在 Authorization 头里，后端校验身份
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // 把购物车每条记录的 quantity 累加，得到总件数
        const count = data.items.reduce((s, i) => s + i.quantity, 0);
        setCartCount(count);
      }
    } catch {}
  }

  // 退出登录：广播登出事件（让所有微前端都清理自己的登录态），再跳回首页
  function logout() {
    bus.emit(EVENTS.LOGOUT);
    navigate('/');
  }

  // NavLink 的 className 可以接收一个函数，参数含 isActive（当前路由是否匹配）。
  // 这里根据 isActive 决定是否追加 active 类名，实现导航高亮。
  const linkClass = ({ isActive }) =>
    'nav-link' + (isActive ? ' active' : '');

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="logo">
          <span className="logo-icon">🛒</span>
          <span>ShopMFE</span>
        </Link>
        <nav className="nav">
          {/* end 表示“仅当路径完全等于 / 时才高亮”，避免首页在所有路径都高亮 */}
          <NavLink to="/" end className={linkClass}>首页</NavLink>
          <NavLink to="/products" className={linkClass}>商品</NavLink>
          <NavLink to="/orders" className={linkClass}>我的订单</NavLink>
          {/* 进阶演示入口：嵌套联邦 / 多实例 */}
          <NavLink to="/workspace" className={linkClass}>工作台</NavLink>
          <NavLink to="/multi" className={linkClass}>多实例</NavLink>
        </nav>
        <div className="header-right">
          <Link to="/cart" className="cart-btn" title="购物车">
            <span className="cart-icon">🛍️</span>
            {/* 购物车有商品时才显示数字角标 */}
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </Link>
          {/* 已登录显示用户名 + 退出按钮；未登录显示登录入口 */}
          {user ? (
            <div className="user-box">
              <span className="user-name">👤 {user.name}</span>
              <button className="btn-text" onClick={logout}>退出</button>
            </div>
          ) : (
            <Link to="/auth/login" className="btn-primary">登录</Link>
          )}
        </div>
      </div>
    </header>
  );
}
