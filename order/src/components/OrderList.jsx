import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, getToken } from '../../../shared/api.js';

const statusText = { pending: '待付款', paid: '已付款', shipped: '已发货' };

export default function OrderList() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api('/orders')
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
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
        <h1 className="page-title">我的订单</h1>
        <div className="empty">
          <div className="empty-icon">🔒</div>
          <p>请先登录后查看订单</p>
          <Link to="/auth/login" className="btn-primary">去登录</Link>
        </div>
      </div>
    );
  }

  if (loading) return <div className="loading">加载中...</div>;
  if (error) return <div className="empty"><p>{error}</p></div>;

  if (!orders || orders.length === 0) {
    return (
      <div>
        <h1 className="page-title">我的订单</h1>
        <div className="empty">
          <div className="empty-icon">📦</div>
          <p>还没有订单</p>
          <Link to="/products" className="btn-primary">去购物</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">我的订单</h1>
      {orders.map((order) => {
        const count = (order.items || []).reduce((s, i) => s + i.quantity, 0);
        return (
          <div
            key={order.id}
            className="card mb-16"
            onClick={() => navigate('/orders/' + order.id)}
            style={{ cursor: 'pointer' }}
          >
            <div className="row-between">
              <div>
                <span>订单号 #{order.id}</span>{' '}
                <span className={`order-status ${order.status}`}>
                  {statusText[order.status] || order.status}
                </span>
              </div>
              <span className="muted">{(order.created_at || '').slice(0, 16)}</span>
            </div>

            <div>
              {(order.items || []).map((item, i) => (
                <div key={i} className="item-row">
                  <div className="item-body">
                    <div className="item-name">{item.product_name} × {item.quantity}</div>
                    <div className="muted">¥{Number(item.price).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="row-between">
              <span className="muted">共 {count} 件商品</span>
              <span className="total-line">¥{Number(order.total || 0).toFixed(2)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
