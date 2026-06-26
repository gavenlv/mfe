import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getToken } from '../../../shared/api.js';
import { bus, EVENTS } from '../../../shared/bus.js';

export default function ProductList() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('all');
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState('');

  // 拉取分类列表
  useEffect(() => {
    api('/products/categories')
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // 根据 category 和 q 拉取商品
  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (q.trim()) params.set('q', q.trim());
    const query = params.toString() ? '?' + params.toString() : '';
    api('/products' + query)
      .then((data) => {
        setProducts(Array.isArray(data) ? data : (data && data.items) || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [category, q]);

  // toast 自动消失
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 1500);
    return () => clearTimeout(t);
  }, [msg]);

  function doSearch() {
    setQ(searchInput);
  }

  async function addToCart(productId, e) {
    if (e) e.stopPropagation();
    if (!getToken()) {
      navigate('/auth/login');
      return;
    }
    try {
      await api('/cart', { method: 'POST', body: { productId, quantity: 1 } });
      const cart = await api('/cart');
      const count = (cart && cart.items ? cart.items : []).reduce(
        (s, i) => s + i.quantity,
        0
      );
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
