/**
 * 文件：ProductDetail.jsx
 * 所属微前端：products（商品微前端）的 components 子目录
 * 核心职责：商品详情页组件。展示单个商品的详细信息，支持选择数量、加入购物车、立即购买。
 *
 * 涉及的关键概念：
 *  - React Hooks：useState 管理商品数据/数量/加载状态；useEffect 在 id 变化时重新拉取详情。
 *  - 路由导航：useNavigate 做编程式跳转（未登录跳登录、立即购买跳结算）；Link 做声明式跳转。
 *  - 鉴权：加购/购买前用 getToken() 判断登录态。
 *  - 跨微前端通信：加购成功后 bus.emit 通知宿主更新购物车角标。
 *  - 数量增减：基于函数式 setState（setQty(v => ...)）保证多次更新不丢更新；
 *    用 Math.max/Math.min 把数量限制在 [1, stock] 区间。
 *  - 条件渲染：根据 loading/error/!product 分别渲染不同 UI。
 *
 * 关于 shared 模块（相对路径 ../../../shared/，跳出 components、src、products 三层）：
 *  - api.js：统一请求封装，内部自动带上 Authorization 头，调用方无需手动加 token。
 *  - bus.js：跨微前端事件总线，用于通知宿主购物车数量变化。
 *  - styles.css：共享设计系统样式（由上层 bootstrap 引入，本文件无直接 import）。
 */

// React 核心 + useState(状态)、useEffect(副作用) hooks
import React, { useState, useEffect } from 'react';
// useNavigate：编程式导航；Link：声明式导航（渲染为 <a>），二者都来自 shared 的 react-router-dom
import { useNavigate, Link } from 'react-router-dom';
// api：统一请求函数（自动带 token）；getToken：读取登录 token 判断登录态
import { api, getToken } from '../../../shared/api.js';
// bus：事件总线；EVENTS：事件名常量
import { bus, EVENTS } from '../../../shared/bus.js';

// 商品详情组件，props.id 由父组件 App.jsx 通过路由正则捕获传入
export default function ProductDetail({ id }) {
  const navigate = useNavigate();
  // 当前商品详情数据，未加载完为 null
  const [product, setProduct] = useState(null);
  // 购买数量，默认 1
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // toast 提示文案
  const [msg, setMsg] = useState('');

  // 拉取商品详情
  // 依赖 [id]：当路由上的商品 id 变化（如从 /products/1 跳到 /products/2）时重新拉取
  useEffect(() => {
    setLoading(true);
    setError(null);
    setProduct(null);
    // 重置数量为 1，避免上一个商品的数量带到新商品
    setQty(1);
    api('/products/' + id)
      .then((data) => {
        setProduct(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [id]);

  // toast 自动消失（1.5s 后清空 msg）
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 1500);
    return () => clearTimeout(t);
  }, [msg]);

  // 加入购物车
  async function addToCart() {
    // 鉴权：未登录跳登录页
    if (!getToken()) {
      navigate('/auth/login');
      return;
    }
    try {
      // 1. 提交加购：注意 productId 转成数字类型、quantity 用当前选中数量
      await api('/cart', {
        method: 'POST',
        body: { productId: Number(id), quantity: qty },
      });
      // 2. 拉取最新购物车，计算总数量
      const cart = await api('/cart');
      const count = (cart && cart.items ? cart.items : []).reduce(
        (s, i) => s + i.quantity,
        0
      );
      // 3. 通知宿主更新角标（微前端间状态独立，需显式通信）
      bus.emit(EVENTS.CART_CHANGED, count);
      setMsg('已加入购物车');
    } catch (err) {
      setMsg(err.message || '加入失败');
    }
  }

  // 立即购买：先加入购物车，再跳转到结算页
  async function buyNow() {
    if (!getToken()) {
      navigate('/auth/login');
      return;
    }
    try {
      // 先把商品加入购物车
      await api('/cart', {
        method: 'POST',
        body: { productId: Number(id), quantity: qty },
      });
      // 拉取最新购物车数量并通知宿主更新角标
      const cart = await api('/cart');
      const count = (cart && cart.items ? cart.items : []).reduce(
        (s, i) => s + i.quantity,
        0
      );
      bus.emit(EVENTS.CART_CHANGED, count);
      // 跳转到结算页（结算页由另一个微前端/宿主负责）
      navigate('/checkout');
    } catch (err) {
      setMsg(err.message || '操作失败');
    }
  }

  // 条件渲染：加载中
  if (loading) return <div className="loading">加载中…</div>;
  // 条件渲染：请求出错
  if (error) return <div className="loading">{error.message}</div>;
  // 条件渲染：商品不存在（数据为空）
  if (!product)
    return (
      <div className="empty">
        <div className="empty-icon">📭</div>
        商品不存在
      </div>
    );

  // 库存：若后端没返回 stock 字段，默认为 0
  const stock = product.stock != null ? product.stock : 0;
  // 减数量：用函数式更新保证基于最新值，且不小于 1
  const dec = () => setQty((v) => Math.max(1, v - 1));
  // 加数量：不超过库存 stock
  const inc = () => setQty((v) => Math.min(stock, v + 1));

  return (
    <div>
      <div className="detail">
        <div className="detail-img">{product.image}</div>
        <div className="detail-info">
          <Link to="/products" className="btn-outline">
            ← 返回列表
          </Link>
          <h1 style={{ marginTop: 12 }}>{product.name}</h1>
          <div style={{ marginTop: 8 }}>
            <span className="tag">{product.category}</span>
          </div>
          <div className="product-rating" style={{ marginTop: 8 }}>
            ⭐ {product.rating}
          </div>
          <div className="detail-price">¥{Number(product.price).toFixed(2)}</div>
          <div className="detail-desc">{product.description}</div>
          <div className="muted mb-16">库存: {stock} 件</div>
          <div className="qty-control mb-24">
            <button className="qty-btn" onClick={dec}>
              -
            </button>
            <span className="qty-val">{qty}</span>
            <button className="qty-btn" onClick={inc}>
              +
            </button>
          </div>
          <div className="row">
            <button className="btn-primary" onClick={addToCart}>
              加入购物车
            </button>
            <button className="btn-outline" onClick={buyNow}>
              立即购买
            </button>
          </div>
        </div>
      </div>

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
