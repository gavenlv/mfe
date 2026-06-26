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
 * 关键概念——embedded（嵌入模式）：
 *  - 进阶用法：本组件除了作为 cart 微前端的“页面”被宿主 shell 加载，
 *    还可能被 workspace 微前端嵌入，或在主应用 /multi 多实例页里作为“小购物车”展示。
 *  - embedded=true 时：隐藏“购物车”标题、隐藏底部“清空购物车 / 去结算”操作栏，
 *    只保留商品列表与每行的数量增减/删除。这样它就变成一个可嵌入的“迷你购物车”组件，
 *    不会通过 navigate('/checkout') 把宿主路由切走。
 *
 * 关于 shared 模块（相对路径 ../../shared/，跳出 cart/src 两层到 mfe/shared）：
 *  - api.js：统一请求封装，调用 api(url, options) 即可发请求，
 *    内部自动带上 Authorization: Bearer <token> 头，调用方无需手动加 token。
 *  - bus.js：跨微前端事件总线。不同微前端状态相互独立，
 *    通过 bus.emit/on 发布订阅来通信（例如通知宿主更新购物车角标）。
 *  - styles.css：共享设计系统样式（由上层 bootstrap 引入，本文件无直接 import）。
 */

// React 核心 + useEffect(副作用)、useState(状态)、useMemo(缓存计算) hooks
import React, { useEffect, useMemo, useState } from 'react';
// Link：声明式导航（渲染为 <a>）；useNavigate：编程式导航。
// 二者来自 shared 的 react-router-dom，复用宿主的路由上下文。
import { Link, useNavigate } from 'react-router-dom';
// api：统一请求函数（自动带 token）；getToken：读取登录 token 判断登录态
import { api, getToken } from '../../shared/api.js';
// bus：事件总线；EVENTS：事件名常量集合（避免魔法字符串）
import { bus, EVENTS } from '../../shared/bus.js';

// 购物车根组件
// props 说明：
//  - embedded: boolean，嵌入模式。true 时隐藏标题与底部操作栏，仅展示列表+增删。
export default function CartApp({ embedded } = {}) {
  // 购物车数据，包含 items(商品列表) 和 total(总价)
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // toast 提示文案（清空购物车等操作后显示，1.5s 后自动消失）
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  // 拉取购物车数据（只更新 state，不 emit 事件）。
  // 单独拆出来是为了让“被动刷新”复用它而不触发事件循环：
  //   - 本组件增删改后调 refresh() → fetchCart + emit（通知别人）
  //   - 监听到别人的 CART_CHANGED → 只调 fetchCart（不再 emit，否则无限循环）
  // 返回 res 方便调用方拿到最新数据做后续处理。
  const fetchCart = async () => {
    try {
      const res = await api('/cart');
      setData(res);
      return res;
    } catch (e) {
      setError(e);
      return null;
    }
  };

  // 首次加载（带 loading 占位）
  const load = async () => {
    if (!getToken()) return;
    setLoading(true);
    setError(null);
    // finally：无论成功失败都关闭 loading，避免一直转圈
    await fetchCart();
    setLoading(false);
  };

  // 刷新（本组件增删改后调用）：拉数据 + 通知其它子应用/宿主更新。
  // 注意：emit 表达“我改了数据，请别人同步”。被动监听到的刷新不能再 emit。
  const refresh = async () => {
    const res = await fetchCart();
    if (res) {
      const count = res.items.reduce((s, i) => s + i.quantity, 0);
      bus.emit(EVENTS.CART_CHANGED, count);
    }
  };

  // 用 useMemo 缓存“总件数”计算结果。
  // 只有 data 变化时才重算，避免每次渲染都执行 reduce（性能优化）。
  // 在购物车列表较长或频繁重渲染时（如多实例页面切 Tab）能减少无谓计算。
  const totalCount = useMemo(
    () => data.items.reduce((s, i) => s + i.quantity, 0),
    [data]
  );

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

  // 【联动关键】监听购物车变化事件，实现多实例/嵌套场景下的联动刷新。
  // 场景：在 /multi 页里，3 个 products 实例 + 1 个 cart 实例同屏；
  //       在 /workspace 页里，products 与 cart 并排。当用户在某个 products 实例加购后，
  //       products 会 emit CART_CHANGED。如果 cart 不监听，它不会知道自己该刷新，
  //       表现为“加购后旁边的购物车没反应”——这就是用户报告的联动 bug。
  // 修复：cart 订阅 CART_CHANGED，收到后调 fetchCart 被动刷新数据。
  // 注意防循环：这里只调 fetchCart（不 emit）。因为 emit 是“我改了数据”的语义，
  //   被动刷新不是自己改数据，不能再 emit，否则会“自己 emit → 自己收到 → 又 emit”无限循环。
  // 返回的 off 函数在组件卸载时调用，清理监听，避免内存泄漏与重复触发。
  useEffect(() => {
    const off = bus.on(EVENTS.CART_CHANGED, () => {
      if (getToken()) fetchCart();
    });
    return () => off();
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
      {/* 嵌入模式下隐藏“购物车”标题，外层容器会提供自己的标题 */}
      {!embedded && <h1 className="page-title">购物车</h1>}
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

      {/* 嵌入模式下隐藏底部操作栏（清空购物车 / 去结算）：
          “去结算”会 navigate('/checkout') 把宿主路由切走，嵌入时不合适；
          “清空”属于全局操作，嵌入场景只展示+增删即可。合计信息仍保留。 */}
      {!embedded && (
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
      )}

      {/* 嵌入模式仍显示合计，让用户看到当前购物车总价 */}
      {embedded && (
        <div className="row-between" style={{ marginTop: 16 }}>
          <span className="muted">共 {totalCount} 件</span>
          <div className="row">
            <span>合计：</span>
            <span className="total-line">¥{data.total.toFixed(2)}</span>
          </div>
        </div>
      )}

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
