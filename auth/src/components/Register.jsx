/**
 * 文件级注释：Register.jsx
 * 所属微前端：auth（认证微前端）
 * 核心职责：注册表单组件。流程与登录几乎一致：提交注册信息 → 后端创建用户并返回 { token, user } →
 *           setAuth 持久化登录态 → bus.emit 通知宿主 → 跳首页。
 *           注册成功即视为"自动登录"，无需再让用户手动登录一次，体验更顺畅。
 * 关键概念：与 Login.jsx 相同（受控表单、JWT、事件总线、async/await 错误处理），详见 Login 注释。
 */
import React, { useState } from 'react'; // React 与 useState Hook
import { useNavigate, Link } from 'react-router-dom'; // 编程式跳转与声明式导航
import { api, setAuth } from '../../../shared/api.js'; // 统一请求封装 + 持久化登录态（写 localStorage）
import { bus, EVENTS } from '../../../shared/bus.js'; // 跨微前端事件总线

function Register() {
  const navigate = useNavigate(); // 宿主 Router 提供的跳转函数
  // 受控表单状态：用户名、密码、姓名三个输入框的值
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false); // 提交中状态（禁用按钮）
  const [error, setError] = useState(''); // 错误提示

  async function handleSubmit(e) {
    e.preventDefault(); // 阻止表单默认刷新行为
    setSubmitting(true);
    setError('');
    try {
      // 注册接口：后端创建用户后直接返回 token，省去再次登录的步骤（注册即登录）
      const { token, user } = await api('/auth/register', {
        method: 'POST',
        body: { username, password, name },
      });
      setAuth(token, user); // 持久化登录态到 localStorage
      bus.emit(EVENTS.LOGIN, user); // 通知宿主更新头部登录状态
      navigate('/'); // 跳首页
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="label">用户名</label>
        <input
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="请输入用户名"
        />
      </div>

      <div className="field-row">
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
        <div className="form-group">
          <label className="label">姓名</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入姓名"
          />
        </div>
      </div>

      {error && (
        <div className="muted" style={{ color: '#ff3b30', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn-primary"
        style={{ width: '100%', justifyContent: 'center' }}
        disabled={submitting}
      >
        {submitting ? '注册中...' : '注册'}
      </button>

      <div className="muted" style={{ marginTop: '16px' }}>
        已有账号？
        <Link to="/auth/login" style={{ color: '#0071e3' }}>
          去登录
        </Link>
      </div>
    </form>
  );
}

export default Register;
