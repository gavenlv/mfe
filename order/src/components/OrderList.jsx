/**
 * 文件级注释：OrderList.jsx
 * 所属微前端：order（订单微前端）
 * 核心职责：订单列表页组件。展示当前用户的所有订单，点击某条可跳转到订单详情。
 * 关键概念：
 *   1. 鉴权：getToken() 判断登录，未登录显示登录引导。
 *   2. useEffect 加载数据：挂载时请求 /orders 获取订单列表。
 *   3. 空状态处理：没有订单时显示引导去购物的空状态。
 *   4. 列表渲染：用 map 渲染每条订单卡片，用 reduce 统计商品总件数。
 *   5. 编程式导航：点击订单卡片 navigate('/orders/' + id) 跳详情页。
 */
import React, { useState, useEffect } from 'react'; // React 与 useState/useEffect Hooks
import { useNavigate, Link } from 'react-router-dom'; // useNavigate 编程式跳转，Link 声明式导航
import { api, getToken } from '../../../shared/api.js'; // shared/api.js：统一请求封装（自动带 token）；
                                                       // getToken() 读取登录 token，用于鉴权判断。

// 订单状态文案映射：把后端的状态码翻译成中文展示
const statusText = { pending: '待付款', paid: '已付款', shipped: '已发货' };

export default function OrderList() {
  const navigate = useNavigate(); // 宿主 Router 提供的跳转函数（点击订单卡片跳详情）
  const [orders, setOrders] = useState([]); // 订单列表数据
  const [loading, setLoading] = useState(true); // 是否正在加载
  const [error, setError] = useState(''); // 错误提示

  // useEffect：组件首次挂载时拉取订单列表（依赖数组 [] 表示只跑一次）
  useEffect(() => {
    // 鉴权：未登录则不发请求
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api('/orders')
      .then((data) => {
        // 兜底：确保 orders 一定是数组，防止后端返回 null 导致 map 报错
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  // 渲染分支：未登录，显示登录引导
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

  if (loading) return <div className="loading">加载中...</div>; // 加载中占位
  if (error) return <div className="empty"><p>{error}</p></div>; // 出错占位

  // 渲染分支：订单为空，引导去购物
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

  // 渲染分支：有订单数据，逐条渲染卡片
  return (
    <div>
      <h1 className="page-title">我的订单</h1>
      {orders.map((order) => {
        // reduce 累加该订单下所有商品的 quantity，得到总件数
        const count = (order.items || []).reduce((s, i) => s + i.quantity, 0);
        return (
          <div
            key={order.id}
            className="card mb-16"
            onClick={() => navigate('/orders/' + order.id)} // 点击整张卡片跳转到该订单详情
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
