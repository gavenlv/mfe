import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, getToken } from '../../../shared/api.js';
import { bus, EVENTS } from '../../../shared/bus.js';

export default function ProductDetail({ id }) {
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState('');

  // 拉取商品详情
  useEffect(() => {
    setLoading(true);
    setError(null);
    setProduct(null);
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

  // toast 自动消失
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 1500);
    return () => clearTimeout(t);
  }, [msg]);

  async function addToCart() {
    if (!getToken()) {
      navigate('/auth/login');
      return;
    }
    try {
      await api('/cart', {
        method: 'POST',
        body: { productId: Number(id), quantity: qty },
      });
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

  async function buyNow() {
    if (!getToken()) {
      navigate('/auth/login');
      return;
    }
    try {
      await api('/cart', {
        method: 'POST',
        body: { productId: Number(id), quantity: qty },
      });
      const cart = await api('/cart');
      const count = (cart && cart.items ? cart.items : []).reduce(
        (s, i) => s + i.quantity,
        0
      );
      bus.emit(EVENTS.CART_CHANGED, count);
      navigate('/checkout');
    } catch (err) {
      setMsg(err.message || '操作失败');
    }
  }

  if (loading) return <div className="loading">加载中…</div>;
  if (error) return <div className="loading">{error.message}</div>;
  if (!product)
    return (
      <div className="empty">
        <div className="empty-icon">📭</div>
        商品不存在
      </div>
    );

  const stock = product.stock != null ? product.stock : 0;
  const dec = () => setQty((v) => Math.max(1, v - 1));
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
