/**
 * 文件级注释：Checkout.jsx
 * 所属微前端：order（订单微前端）
 * 核心职责：结算页组件。展示购物车商品、填写收货信息、提交订单。
 * 关键概念：
 *   1. 鉴权：用 getToken() 判断登录态，未登录则显示"请先登录"提示并引导去登录页。
 *   2. useEffect 加载数据：组件首次挂载时请求 /cart 获取购物车内容。
 *   3. 受控表单：收货地址、联系电话用 useState 管理。
 *   4. 跨微前端通信：下单成功后 bus.emit(EVENTS.CART_CHANGED, 0) 通知宿主
 *      把购物车角标清零（购物车归 products 微前端管，order 不能直接改它的状态，只能发事件通知）。
 *   5. 下单后跳转：navigate('/orders/' + orderId) 跳到订单详情页查看刚下的订单。
 */
import React, { useState, useEffect } from 'react'; // React 与 useState/useEffect Hooks
import { useNavigate, Link } from 'react-router-dom'; // useNavigate 编程式跳转，Link 声明式导航
import { api, getToken } from '../../../shared/api.js'; // shared/api.js：统一请求封装（自动带 token）；
                                                       // getToken() 读取 localStorage 中的登录 token，用于鉴权判断。
import { bus, EVENTS } from '../../../shared/bus.js'; // shared/bus.js：跨微前端事件总线，
                                                       // 用于下单后通知宿主清空购物车角标。

export default function Checkout() {
  const navigate = useNavigate(); // 宿主 Router 提供的跳转函数（下单成功后跳订单详情）
  const [cart, setCart] = useState({ items: [], total: 0 }); // 购物车数据（商品列表 + 总价）
  const [loading, setLoading] = useState(true); // 是否正在加载购物车
  const [error, setError] = useState(''); // 错误提示
  const [address, setAddress] = useState(''); // 收货地址（受控表单）
  const [phone, setPhone] = useState(''); // 联系电话（受控表单）
  const [submitting, setSubmitting] = useState(false); // 是否正在提交订单
  const [msg, setMsg] = useState(''); // 成功提示文案

  // useEffect：组件首次挂载时执行（依赖数组为 [] 表示只在 mount 时跑一次）。
  useEffect(() => {
    // 鉴权：未登录则不发请求，直接结束 loading。
    if (!getToken()) {
      setLoading(false);
      return;
    }
    // 已登录则请求购物车数据。api() 会自动带上 token。
    api('/cart')
      .then((data) => {
        setCart(data || { items: [], total: 0 }); // 兜底：data 为空时用空购物车
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  // 渲染分支：未登录，显示登录引导（鉴权拦截）
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

  if (loading) return <div className="loading">加载中...</div>; // 加载中占位
  if (error) return <div className="empty"><p>{error}</p></div>; // 出错占位

  // 渲染分支：购物车为空，引导去购物
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

  // 提交订单处理函数：由表单 onSubmit 触发
  const handleSubmit = (e) => {
    e.preventDefault(); // 阻止表单默认刷新行为
    // 简单校验：地址和电话不能为空
    if (!address.trim() || !phone.trim()) {
      setError('请填写收货地址和联系电话');
      return;
    }
    setSubmitting(true); // 进入提交中状态
    setError('');
    setMsg('');
    // 调用下单接口，提交收货信息
    api('/orders', { method: 'POST', body: { address, phone } })
      .then((data) => {
        // 跨微前端通信：通知宿主购物车已清空（角标归 0）。
        // 购物车角标由宿主头部维护，order 微前端无法直接修改，只能通过事件总线告知。
        bus.emit(EVENTS.CART_CHANGED, 0);
        // 下单成功后跳转到该订单的详情页
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
