import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, getToken } from '../../../shared/api.js';

const statusText = { pending: '待付款', paid: '已付款', shipped: '已发货' };

export default function OrderDetail({ id }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    api('/orders/' + id)
      .then((data) => {
        setOrder(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [id]);

  if (!getToken()) {
    return (
      <div>
        <Link to="/orders" className="btn-outline">← 返回订单列表</Link>
        <h1 className="page-title">订单详情 #{id}</h1>
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
  if (!order) return <div className="empty"><p>订单不存在</p></div>;

  const count = (order.items || []).reduce((s, i) => s + i.quantity, 0);

  return (
    <div>
      <Link to="/orders" className="btn-outline">← 返回订单列表</Link>
      <h1 className="page-title">订单详情 #{id}</h1>

      <div className="card">
        <div className="row-between mb-16">
          <span className={`order-status ${order.status}`}>
            {statusText[order.status] || order.status}
          </span>
          <span className="muted">{(order.created_at || '').slice(0, 16)}</span>
        </div>

        <div className="form-group">
          <div className="label">收货地址</div>
          <div>{order.address}</div>
        </div>

        <div className="form-group">
          <div className="label">联系电话</div>
          <div>{order.phone}</div>
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
    </div>
  );
}
