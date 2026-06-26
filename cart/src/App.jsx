/**
 * 文件：App.jsx
 * 所属微前端：cart（购物车微前端）
 * 核心职责：购物车页面的根组件。负责展示购物车商品列表，支持修改数量、删除、清空、结算。
 *
 * 涉及的关键概念：
 *  - React Hooks：useState 管理购物车数据/加载/错误/提示状态；
 *    useEffect 在组件挂载时拉取购物车数据、在 msg 变化时启动 toast 定时器。
 *  - 鉴权：用 getToken() 判断登录态，未登录时渲染“请先登录”提示并提供去登录入口。
 *  - 跨微前端通信：每次增删改后通过 bus.emit(EVENTS.CART_CHANGED, count)
 *    通知宿主更新购物车角标（微前端之间状态独立，需显式同步）。
 *  - 条件渲染：根据未登录/加载中/出错/空车/有商品 分别渲染不同 UI。
 *  - 路由导航：Link 声明式跳转（去登录/去购物），useNavigate 编程式跳转（去结算）。
 *  - 异步函数 + try/catch/finally：处理接口请求的成功/失败/收尾逻辑。
 *
 * 关于 shared 模块（相对路径 ../../shared/，跳出 cart/src 两层到 mfe/shared）：
 *  - api.js：统一请求封装，调用 api(url, options) 即可发请求，
 *    内部自动带上 Authorization: Bearer <token> 头，调用方无需手动加 token。
 *  - bus.js：跨微前端事件总线。不同微前端状态相互独立，
 *    通过 bus.emit/on 发布订阅来通信（例如通知宿主更新购物车角标）。
 *  - styles.css：共享设计系统样式（由上层 bootstrap 引入，本文件无直接 import）。
 */

// React 核心 + useEffect(副作用)、useState(状态) hooks
import React, { useEffect, useState } from 'react';
// Link：声明式导航（渲染为 <a>）；useNavigate：编程式导航。
// 二者来自 shared 的 react-router-dom，复用宿主的路由上下文。
import { Link, useNavigate } from 'react-router-dom';
// api：统一请求函数（自动带 token）；getToken：读取登录 token 判断登录态
import { api, getToken } from '../../shared/api.js';
// bus：事件总线；EVENTS：事件名常量集合（避免魔法字符串）
import { bus, EVENTS } from '../../shared/bus.js';

// 购物车根组件
export default function CartApp() {
  // 购物车数据，包含 items(商品列表) 和 total(总价)
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // toast 提示文案（清空购物车等操作后显示，1.5s 后自动消失）
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  // 拉取购物车数据（首次加载用）
  // 未登录时直接返回，不发请求
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
      // finally：无论成功失败都关闭 loading，避免一直转圈
      setLoading(false);
    }
  };

  // 刷新购物车数据（增删改后调用）
  // 与 load 的区别：刷新后还会重新计算总数量并通知宿主更新角标
  const refresh = async () => {
    try {
      const res = await api('/cart');
      setData(res);
      // 计算购物车总件数（数量累加）
      const count = res.items.reduce((s, i) => s + i.quantity, 0);
      // 通知宿主更新购物车角标数量
      bus.emit(EVENTS.CART_CHANGED, count);
    } catch (e) {
      setError(e);
    }
  };

  // 修改某商品数量
  // productId：商品 id；newQty：目标数量
  const updateQty = async (productId, newQty) => {
    // 用 Math.max(1, newQty) 保证数量不小于 1
    const qty = Math.max(1, newQty);
    try {
      await api('/cart/' + productId, { method: 'PUT', body: { quantity: qty } });
      // 修改成功后刷新购物车（同时更新角标）
      await refresh();
    } catch (e) {
      setError(e);
    }
  };

  // 删除购物车中的某件商品
  const remove = async (productId) => {
    try {
      await api('/cart/' + productId, { method: 'DELETE' });
      await refresh();
    } catch (e) {
      setError(e);
    }
  };

  // 清空购物车
  const clearAll = async () => {
    // window.confirm：浏览器原生确认框，点取消则直接返回不执行
    if (!window.confirm('确定要清空购物车吗？')) return;
    try {
      await api('/cart', { method: 'DELETE' });
      await refresh();
      setMsg('购物车已清空');
    } catch (e) {
      setError(e);
    }
  };

  // 组件首次挂载时拉取购物车数据
  // 依赖 []：仅执行一次
  useEffect(() => {
    load();
  }, []);

  // toast 自动消失（1.5s 后清空 msg）
  // 依赖 [msg]：msg 变化时启动定时器；返回函数会在下次执行前/卸载时清除定时器
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 1500);
    return () => clearTimeout(t);
  }, [msg]);

  // 条件渲染：未登录 → 提示去登录
  if (!getToken()) {
    return (
      <div className="empty">
        <div className="empty-icon">🔒</div>
        <p>请先登录后查看购物车</p>
        <Link to="/auth/login" className="btn-primary">去登录</Link>
      </div>
    );
  }

  // 条件渲染：加载中
  if (loading) {
    return <div className="loading">加载中…</div>;
  }

  // 条件渲染：出错
  if (error) {
    return <div className="loading">{error.message}</div>;
  }

  // 条件渲染：购物车为空 → 引导去购物
  if (data.items.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">🛍️</div>
        <p>购物车是空的</p>
        <Link to="/products" className="btn-primary">去购物</Link>
      </div>
    );
  }

  // 正常渲染：购物车商品列表 + 底部操作栏
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
