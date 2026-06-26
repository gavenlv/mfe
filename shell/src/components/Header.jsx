import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { bus, EVENTS } from '../bus.js';

export default function Header() {
  const [cartCount, setCartCount] = useState(0);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // 从 localStorage 恢复用户
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));

    const offCart = bus.on(EVENTS.CART_CHANGED, (count) => setCartCount(count));
    const offLogin = bus.on(EVENTS.LOGIN, (u) => {
      setUser(u);
      localStorage.setItem('user', JSON.stringify(u));
    });
    const offLogout = bus.on(EVENTS.LOGOUT, () => {
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    });

    // 拉取初始购物车数量
    fetchCartCount();

    return () => {
      offCart();
      offLogin();
      offLogout();
    };
  }, []);

  async function fetchCartCount() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('http://localhost:3001/api/cart', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const count = data.items.reduce((s, i) => s + i.quantity, 0);
        setCartCount(count);
      }
    } catch {}
  }

  function logout() {
    bus.emit(EVENTS.LOGOUT);
    navigate('/');
  }

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
          <NavLink to="/" end className={linkClass}>首页</NavLink>
          <NavLink to="/products" className={linkClass}>商品</NavLink>
          <NavLink to="/orders" className={linkClass}>我的订单</NavLink>
        </nav>
        <div className="header-right">
          <Link to="/cart" className="cart-btn" title="购物车">
            <span className="cart-icon">🛍️</span>
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </Link>
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
