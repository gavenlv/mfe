/**
 * 文件级注释：OrderDetail.jsx
 * 所属微前端：order（订单微前端）
 * 核心职责：订单详情页组件。展示单个订单的完整信息（状态、收货信息、商品明细、总价）。
 * 关键概念：
 *   1. 鉴权：getToken() 判断登录，未登录显示登录引导。
 *   2. props 接收参数：组件通过 props.id 接收订单 id（由 App.jsx 从 URL 正则提取后传入）。
 *   3. useEffect 依赖 id：当 id 变化时重新请求订单详情（依赖数组写成 [id]）。
 *   4. 数据未到 / 不存在 / 出错三种异常态的分别处理。
 */
import React, { useState, useEffect } from 'react'; // React 与 useState/useEffect Hooks
import { Link } from 'react-router-dom'; // Link 声明式导航（返回订单列表）
import { api, getToken } from '../../../shared/api.js'; // shared/api.js：统一请求封装（自动带 token）；
                                                       // getToken() 读取登录 token，用于鉴权判断。

// 订单状态文案映射：把后端的状态码翻译成中文展示
const statusText = { pending: '待付款', paid: '已付款', shipped: '已发货' };

export default function OrderDetail({ id }) { // 通过 props 接收订单 id（由 App.jsx 从 URL 正则提取后传入）
  const [order, setOrder] = useState(null); // 订单详情数据，初始为 null（区分"还没请求到"与"请求到空"）
  const [loading, setLoading] = useState(true); // 是否正在加载
  const [error, setError] = useState(''); // 错误提示

  // useEffect 依赖 [id]：当 id 变化时重新请求该订单详情。
  // 这样从列表跳到不同订单详情、或直接改 URL 时，组件会自动刷新数据。
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

  // 渲染分支：未登录，显示登录引导
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

  if (loading) return <div className="loading">加载中...</div>; // 加载中占位
  if (error) return <div className="empty"><p>{error}</p></div>; // 出错占位
  if (!order) return <div className="empty"><p>订单不存在</p></div>; // 订单不存在占位

  // 统计该订单的商品总件数
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
