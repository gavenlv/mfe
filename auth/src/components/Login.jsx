/**
 * 文件级注释：Login.jsx
 * 所属微前端：auth（认证微前端）
 * 核心职责：登录表单组件。完成"提交账号密码 → 拿到 token → 存登录态 → 通知宿主 → 跳首页"的完整登录流程。
 * 关键概念：
 *   1. JWT 登录流程：提交表单 → 后端校验通过返回 { token, user } →
 *      setAuth(token, user) 把 token 和用户信息存进 localStorage（持久化登录态）→
 *      bus.emit(EVENTS.LOGIN, user) 通过事件总线通知宿主更新顶部登录状态 →
 *      navigate('/') 跳转到首页。
 *   2. React Hooks 受控表单：用 useState 保存每个输入框的值，onChange 同步更新，
 *      这样表单数据成为 React 状态的一部分，提交时可直接读取。
 *   3. 跨微前端通信：登录成功后用 bus（事件总线）广播登录事件，
 *      宿主监听到后刷新头部头像/用户名，无需重新刷新页面。
 *   4. async/await + try/catch/finally：异步请求的标准错误处理范式。
 */
import React, { useState } from 'react'; // React 与 useState Hook
import { useNavigate, Link } from 'react-router-dom'; // useNavigate 编程式跳转，Link 声明式导航
import { api, setAuth } from '../../../shared/api.js'; // shared/api.js：统一请求封装，
                                                       // api() 会自动给请求带上 token、处理 JSON；
                                                       // setAuth() 把 token/user 写入 localStorage。
import { bus, EVENTS } from '../../../shared/bus.js'; // shared/bus.js：跨微前端事件总线，
                                                       // 微前端之间不直接互相 import，
                                                       // 而是通过 bus.emit/on 收发事件（如登录、购物车变化）。

function Login() {
  // useNavigate：拿到宿主 Router 提供的跳转函数，用于登录成功后跳转首页
  const navigate = useNavigate();
  // 以下 useState 都是受控表单的状态：输入框的值与状态绑定，onChange 更新状态
  const [username, setUsername] = useState(''); // 用户名输入框的值
  const [password, setPassword] = useState(''); // 密码输入框的值
  const [submitting, setSubmitting] = useState(false); // 是否正在提交（控制按钮禁用与文案）
  const [error, setError] = useState(''); // 错误提示文案

  // 表单提交处理函数：声明为 async 函数，便于内部 await 异步请求
  async function handleSubmit(e) {
    e.preventDefault(); // 阻止表单默认提交行为（默认会刷新整页，SPA 中要阻止）
    setSubmitting(true); // 进入提交中状态，禁用按钮防止重复提交
    setError(''); // 清空上次的错误提示
    try {
      // 调用统一请求封装向后端发登录请求，返回 { token, user }
      const { token, user } = await api('/auth/login', {
        method: 'POST',
        body: { username, password },
      });
      setAuth(token, user); // 把 token 和用户信息持久化到 localStorage，后续请求自动带 token
      bus.emit(EVENTS.LOGIN, user); // 通过事件总线通知宿主：用户已登录，请更新头部登录状态
      navigate('/'); // 跳转到首页
    } catch (err) {
      // 请求失败（网络错或密码错）时，把错误信息显示给用户
      setError(err.message);
    } finally {
      // 无论成功失败，都退出"提交中"状态，恢复按钮
      setSubmitting(false);
    }
  }

  return (
    // onSubmit={handleSubmit}：监听表单提交事件（点击 type="submit" 按钮或按回车都会触发）
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="label">用户名</label>
        <input
          className="input"
          value={username} // 受控：输入框的值来自 state
          onChange={(e) => setUsername(e.target.value)} // 输入时同步更新 state
          placeholder="请输入用户名"
        />
      </div>
      <div className="form-group">
        <label className="label">密码</label>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="请输入密码"
        />
      </div>

      {/* 错误提示：仅当 error 非空（为真）时才渲染这一段 */}
      {error && (
        <div className="muted" style={{ color: '#ff3b30', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn-primary"
        style={{ width: '100%', justifyContent: 'center' }}
        disabled={submitting} // 提交中禁用按钮，防止重复提交
      >
        {submitting ? '登录中...' : '登录'}
      </button>

      <div className="muted" style={{ marginTop: '16px' }}>
        还没有账号？
        {/* Link 是 react-router-dom 的声明式导航，点击不会刷新页面，由 SPA 路由接管 */}
        <Link to="/auth/register" style={{ color: '#0071e3' }}>
          去注册
        </Link>
      </div>

      <div className="muted" style={{ marginTop: '12px' }}>
        演示账号：demo / demo123
      </div>
    </form>
  );
}

export default Login;
