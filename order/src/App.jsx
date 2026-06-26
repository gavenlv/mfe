import React from 'react';
import { useLocation } from 'react-router-dom';
import Checkout from './components/Checkout.jsx';
import OrderList from './components/OrderList.jsx';
import OrderDetail from './components/OrderDetail.jsx';

export default function OrderApp() {
  const location = useLocation();
  const pathname = location.pathname;

  if (pathname === '/checkout') {
    return <Checkout />;
  }

  const detailMatch = pathname.match(/^\/orders\/(\d+)$/);
  if (detailMatch) {
    return <OrderDetail id={detailMatch[1]} />;
  }

  if (pathname === '/orders' || pathname.startsWith('/orders')) {
    return <OrderList />;
  }

  return <OrderList />;
}
