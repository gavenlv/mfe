import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getToken } from '../../shared/api.js';
import { bus, EVENTS } from '../../shared/bus.js';

export default function CartApp() {
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  const load = async () => {
    if (!getToken()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api('/cart');
      setData(res);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    try {
      const res = await api('/cart');
      setData(res);
      const count = res.items.reduce((s, i) => s + i.quantity, 0);
      bus.emit(EVENTS.CART_CHANGED, count);
    } catch (e) {
      setError(e);
    }
  };

  const updateQty = async (productId, newQty) => {
    const qty = Math.max(1, newQty);
    try {
      await api('/cart/' + productId, { method: 'PUT', body: { quantity: qty } });
      await refresh();
    } catch (e) {
      setError(e);
    }
  };

  const remove = async (productId) => {
    try {
      await api('/cart/' + productId, { method: 'DELETE' });
      await refresh();
    } catch (e) {
      setError(e);
    }
  };

  const clearAll = async () => {
    if (!window.confirm('确定要清空购物车吗？')) return;
    try {
      await api('/cart', { method: 'DELETE' });
      await refresh();
      setMsg('购物车已清空');
    } catch (e) {
      setError(e);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 1500);
    return () => clearTimeout(t);
  }, [msg]);

  if (!getToken()) {
    return (
      <div className="empty">
        <div className="empty-icon">🔒</div>
        <p>请先登录后查看购物车</p>
        <Link to="/auth/login" className="btn-primary">去登录</Link>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">加载中…</div>;
  }

  if (error) {
    return <div className="loading">{error.message}</div>;
  }

  if (data.items.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">🛍️</div>
        <p>购物车是空的</p>
        <Link to="/products" className="btn-primary">去购物</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">购物车</h1>
      <div className="card">
        {data.items.map((item) => (
          <div className="item-row" key={item.productId}>
            <div className="item-img">{item.image}</div>
            <div className="item-body">
              <div className="item-name">{item.name}</div>
              <div className="muted">¥{item.price.toFixed(2)}</div>
            </div>
            <div className="qty-control">
              <button
                className="qty-btn"
                disabled={item.quantity <= 1}
                onClick={() => updateQty(item.productId, item.quantity - 1)}
              >
                -
              </button>
              <span className="qty-val">{item.quantity}</span>
              <button
                className="qty-btn"
                onClick={() => updateQty(item.productId, item.quantity + 1)}
              >
                +
              </button>
            </div>
            <button className="btn-danger" onClick={() => remove(item.productId)}>
              删除
            </button>
          </div>
        ))}
      </div>

      <div className="row-between" style={{ marginTop: 16 }}>
        <button className="btn-danger" onClick={clearAll}>
          清空购物车
        </button>
        <div className="row">
          <span>合计：</span>
          <span className="total-line">¥{data.total.toFixed(2)}</span>
          <button className="btn-primary" onClick={() => navigate('/checkout')}>
            去结算
          </button>
        </div>
      </div>

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
