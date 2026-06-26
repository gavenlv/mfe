import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, getToken } from '../../../shared/api.js';
import { bus, EVENTS } from '../../../shared/bus.js';

export default function Checkout() {
  const navigate = useNavigate();
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api('/cart')
      .then((data) => {
        setCart(data || { items: [], total: 0 });
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (!getToken()) {
    return (
      <div>
        <h1 className="page-title">结算</h1>
        <div className="empty">
          <div className="empty-icon">🔒</div>
          <p>请先登录后结算</p>
          <Link to="/auth/login" className="btn-primary">去登录</Link>
        </div>
      </div>
    );
  }

  if (loading) return <div className="loading">加载中...</div>;
  if (error) return <div className="empty"><p>{error}</p></div>;

  if (!cart.items || cart.items.length === 0) {
    return (
      <div>
        <h1 className="page-title">结算</h1>
        <div className="empty">
          <div className="empty-icon">🛒</div>
          <p>购物车是空的</p>
          <Link to="/products" className="btn-primary">去购物</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!address.trim() || !phone.trim()) {
      setError('请填写收货地址和联系电话');
      return;
    }
    setSubmitting(true);
    setError('');
    setMsg('');
    api('/orders', { method: 'POST', body: { address, phone } })
      .then((data) => {
        bus.emit(EVENTS.CART_CHANGED, 0);
        navigate('/orders/' + data.orderId);
      })
      .catch((e) => {
        setError(e.message);
        setSubmitting(false);
      });
  };

  return (
    <div>
      <h1 className="page-title">结算</h1>

      <div className="card mb-16">
        {cart.items.map((item, i) => (
          <div key={i} className="item-row">
            <div className="item-body">
              <div className="item-name">{item.name} × {item.quantity}</div>
              <div className="muted">¥{(item.price * item.quantity).toFixed(2)}</div>
            </div>
          </div>
        ))}
        <div className="row-between">
          <span>合计</span>
          <span className="total-line">¥{(cart.total || 0).toFixed(2)}</span>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <div className="label">收货地址</div>
            <textarea
              className="textarea"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="请输入收货地址"
            />
          </div>
          <div className="form-group">
            <div className="label">联系电话</div>
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入联系电话"
            />
          </div>
          {msg && <p className="muted">{msg}</p>}
          {error && <p className="muted">{error}</p>}
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || cart.items.length === 0}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {submitting ? '提交中...' : '提交订单'}
          </button>
        </form>
      </div>
    </div>
  );
}
