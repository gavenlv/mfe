/**
 * 文件级注释：App.jsx
 * 所属微前端：order（订单微前端）
 * 核心职责：order 微前端的根组件，被 vite.config.js 通过 exposes['./App'] 暴露给宿主。
 *           负责根据当前 URL 路径，决定渲染"结算页 / 订单列表 / 订单详情"中的哪一个。
 * 关键概念：
 *   1. 路径分发：order 微前端并不自己写 BrowserRouter，
 *      而是直接用 useLocation 读取宿主路由的当前 pathname，再用字符串匹配/正则决定渲染哪个子页面。
 *      - /checkout          → 结算页 Checkout
 *      - /orders/:id        → 订单详情 OrderDetail（用正则 /^\/orders\/(\d+)$/ 提取 id）
 *      - /orders 或其子路径 → 订单列表 OrderList
 *   2. 为什么不写自己的 BrowserRouter？因为 react-router-dom 是 shared 共享依赖，
 *      整个应用只存在一个 Router 实例（由宿主提供）。微前端复用宿主的路由上下文，
 *      useLocation / useNavigate / Link 才能正确工作。如果微前端再套一层 Router，
 *      就会形成"路由器中的路由器"，URL 变化无法传递到子组件。
 */
import React from 'react'; // React 库（shared 共享依赖）
import { useLocation } from 'react-router-dom'; // 从共享的 react-router-dom 取 useLocation，
                                                // 读取宿主 Router 提供的当前路径信息
import Checkout from './components/Checkout.jsx'; // 结算页组件
import OrderList from './components/OrderList.jsx'; // 订单列表组件
import OrderDetail from './components/OrderDetail.jsx'; // 订单详情组件

export default function OrderApp() {
  const location = useLocation(); // 读取宿主路由上下文中的当前 location 对象
  const pathname = location.pathname; // pathname 是 URL 的路径部分，例如 /checkout、/orders/12

  // 分支 1：结算页。路径精确等于 /checkout 时渲染结算组件。
  if (pathname === '/checkout') {
    return <Checkout />;
  }

  // 分支 2：订单详情。用正则匹配 /orders/数字，并捕获数字作为订单 id。
  // match 返回数组，第 1 项是整段匹配，第 2 项是第一个捕获组（即订单 id）。
  const detailMatch = pathname.match(/^\/orders\/(\d+)$/);
  if (detailMatch) {
    // 把从 URL 提取到的 id 作为 prop 传给 OrderDetail 组件
    return <OrderDetail id={detailMatch[1]} />;
  }

  // 分支 3：订单列表。/orders 或以 /orders 开头的路径都展示列表。
  if (pathname === '/orders' || pathname.startsWith('/orders')) {
    return <OrderList />;
  }

  // 兜底：其他情况默认渲染订单列表
  return <OrderList />;
}
