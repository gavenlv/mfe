/**
 * 文件级注释：App.jsx
 * 所属微前端：auth（认证微前端）
 * 核心职责：auth 微前端的根组件，被 vite.config.js 通过 exposes['./App'] 暴露给宿主。
 *           负责根据当前 URL 路径，决定渲染"登录页"还是"注册页"。
 * 关键概念：
 *   1. 路径分发：auth 微前端并不自己写 BrowserRouter，
 *      而是直接使用 react-router-dom 提供的 useLocation 读取宿主路由的当前路径，
 *      用路径后缀判断要展示哪个子页面（/auth/register → 注册，其他 → 登录）。
 *   2. 为什么不写自己的 BrowserRouter？因为 react-router-dom 是 shared 共享依赖，
 *      整个应用只存在一个 Router 实例（由宿主提供）。微前端复用宿主的路由上下文，
 *      useLocation / useNavigate / Link 才能正确工作。如果微前端再套一层 Router，
 *      就会形成"路由器中的路由器"，URL 变化无法传递到子组件。
 */
import React from 'react'; // React 库（shared 共享依赖）
import { useLocation } from 'react-router-dom'; // 从共享的 react-router-dom 取 useLocation，
                                                // 读取宿主 Router 提供的当前路径信息
import Login from './components/Login.jsx'; // 登录页组件
import Register from './components/Register.jsx'; // 注册页组件

function AuthApp() {
  // 读取宿主路由上下文中的当前 location 对象（pathname 是 URL 的路径部分）
  const location = useLocation();
  // 判断当前路径是否以 /register 结尾：是则显示注册页，否则显示登录页。
  // 这种"按路径后缀切换"的方式，让宿主可以用 /auth/login、/auth/register 统一接管 auth 微前端。
  const isRegister = location.pathname.endsWith('/register');

  return (
    <div style={{ maxWidth: '420px', margin: '0 auto', paddingTop: '40px' }}>
      <h1 className="page-title" style={{ textAlign: 'center' }}>
        {isRegister ? '注册' : '登录'}
      </h1>
      <div className="card">
        {/* 根据 isRegister 二选一渲染对应组件 */}
        {isRegister ? <Register /> : <Login />}
      </div>
    </div>
  );
}

export default AuthApp;
