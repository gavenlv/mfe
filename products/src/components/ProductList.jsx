/**
 * 文件：ProductList.jsx
 * 所属微前端：products（商品微前端）的 components 子目录
 * 核心职责：商品列表页组件。展示全部商品，支持关键字搜索、分类筛选、加入购物车。
 *
 * 涉及的关键概念：
 *  - React Hooks：useState 管理状态、useEffect 处理副作用（请求数据、定时器）。
 *  - 受控组件：搜索框 input 的 value 绑定 state，onChange 更新 state，输入完全受 React 控制。
 *  - 跨微前端通信：加入购物车后，通过 bus.emit 通知宿主更新购物车角标数量。
 *  - 鉴权：加购前用 getToken() 判断登录态，未登录跳转到登录页。
 *  - 事件冒泡：卡片整体可点击跳详情，但点“加入购物车”按钮不应触发跳转，用 stopPropagation 阻止。
 *  - URLSearchParams：构造查询字符串（?category=xx&q=yy）。
 *
 * 关于 shared 模块（相对路径 ../../../shared/，跳出 components、src、products 三层到 mfe/shared）：
 *  - api.js：统一的请求封装。调用 api(url, options) 即可发请求，内部自动带上
 *    Authorization: Bearer <token> 头，省去每个调用处手动加 token。
 *  - bus.js：跨微前端事件总线。不同微前端状态相互独立，无法直接共享 store，
 *    通过 bus.emit/on 发布订阅来通信（例如通知宿主更新购物车角标）。
 *  - styles.css：共享设计系统样式（在本文件无直接 import，由上层 bootstrap 引入）。
 */

// React 核心 + useState(状态)、useEffect(副作用) hooks
import React, { useState, useEffect } from 'react';
// useNavigate：编程式导航 hook，可代码触发跳转（如未登录跳到 /auth/login）
import { useNavigate } from 'react-router-dom';
// api：统一请求函数（自动带 token）；getToken：读取当前登录 token（判断登录态）
import { api, getToken } from '../../../shared/api.js';
// bus：事件总线；EVENTS：事件名常量集合（避免魔法字符串）
import { bus, EVENTS } from '../../../shared/bus.js';

// 商品列表组件
export default function ProductList() {
  // useNavigate 返回一个 navigate 函数，调用即可跳转路由
  const navigate = useNavigate();
  // 商品列表数据，初始为空数组
  const [products, setProducts] = useState([]);
  // 分类列表（从后端拉取），初始空数组
  const [categories, setCategories] = useState([]);
  // 当前选中的分类，'all' 表示全部
  const [category, setCategory] = useState('all');
  // 实际用于请求的搜索关键字（按回车/点搜索后才更新）
  const [q, setQ] = useState('');
  // 搜索框实时输入的值（受控），与 q 分离避免每输一个字就发请求
  const [searchInput, setSearchInput] = useState('');
  // 加载中标记，控制“加载中…”提示
  const [loading, setLoading] = useState(false);
  // 错误对象，请求失败时展示错误信息
  const [error, setError] = useState(null);
  // toast 提示文案（加购成功/失败时显示，1.5s 后自动消失）
  const [msg, setMsg] = useState('');

  // 拉取分类列表
  // 依赖数组为 []：仅在组件首次挂载时执行一次
  useEffect(() => {
    api('/products/categories')
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // 根据 category 和 q 拉取商品
  // 依赖数组 [category, q]：当分类或搜索关键字变化时，重新拉取商品
  useEffect(() => {
    setLoading(true);
    setError(null);
    // 用 URLSearchParams 构造查询字符串，自动处理编码与 & 拼接
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (q.trim()) params.set('q', q.trim());
    // 没有参数时 query 为空字符串，否则拼成 ?category=xx&q=yy
    const query = params.toString() ? '?' + params.toString() : '';
    api('/products' + query)
      .then((data) => {
        // 后端可能返回数组，也可能返回 { items: [...] } 形式，做兼容处理
        setProducts(Array.isArray(data) ? data : (data && data.items) || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [category, q]);

  // toast 自动消失
  // 依赖 [msg]：msg 变化时启动定时器，1.5s 后清空；返回的函数会在下次执行前/卸载时清除定时器
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 1500);
    return () => clearTimeout(t);
  }, [msg]);

  // 点击搜索按钮：把搜索框的输入“提交”为实际查询关键字 q
  function doSearch() {
    setQ(searchInput);
  }

  // 加入购物车
  // productId：商品 id；e：点击事件对象（用于阻止冒泡）
  async function addToCart(productId, e) {
    // 阻止事件冒泡：否则会触发外层卡片的 onClick（跳详情页）
    if (e) e.stopPropagation();
    // 鉴权：未登录直接跳登录页，不发起加购请求
    if (!getToken()) {
      navigate('/auth/login');
      return;
    }
    try {
      // 1. 调用加购接口，加入 1 件
      await api('/cart', { method: 'POST', body: { productId, quantity: 1 } });
      // 2. 重新拉取购物车，算出最新总数量
      const cart = await api('/cart');
      const count = (cart && cart.items ? cart.items : []).reduce(
        (s, i) => s + i.quantity,
        0
      );
      // 3. 通过事件总线通知宿主更新购物车角标
      //    微前端之间状态独立，宿主的购物车数量不会自动同步，必须显式通知
      bus.emit(EVENTS.CART_CHANGED, count);
      setMsg('已加入购物车');
    } catch (err) {
      setMsg(err.message || '加入失败');
    }
  }

  return (
    <div>
      <h1 className="page-title">全部商品</h1>

      <div className="search-box">
        <input
          className="input"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') doSearch();
          }}
          placeholder="搜索商品..."
        />
        <button className="btn-primary" onClick={doSearch}>
          搜索
        </button>
      </div>

      <div className="cat-bar">
        <button
          className={'cat-chip' + (category === 'all' ? ' active' : '')}
          onClick={() => setCategory('all')}
        >
          全部
        </button>
        {categories.map((c) => (
          <button
            key={c}
            className={'cat-chip' + (category === c ? ' active' : '')}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {loading && <div className="loading">加载中…</div>}
      {error && <div className="loading">{error.message}</div>}
      {!loading && !error && products.length === 0 && (
        <div className="empty">
          <div className="empty-icon">📭</div>
          没有找到商品
        </div>
      )}

      <div className="grid">
        {products.map((p) => (
          <div
            key={p.id}
            className="product-card"
            onClick={() => navigate(`/products/${p.id}`)}
          >
            <div className="product-img">{p.image}</div>
            <div className="product-info">
              <div className="product-name">{p.name}</div>
              <div className="product-cat">{p.category}</div>
              <div className="product-rating">⭐ {p.rating}</div>
              <div className="product-price">¥{Number(p.price).toFixed(2)}</div>
              <button
                className="btn-primary"
                style={{ marginTop: 8, alignSelf: 'flex-start' }}
                onClick={(e) => addToCart(p.id, e)}
              >
                加入购物车
              </button>
            </div>
          </div>
        ))}
      </div>

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
