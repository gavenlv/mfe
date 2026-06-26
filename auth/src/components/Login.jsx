import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setAuth } from '../../../shared/api.js';
import { bus, EVENTS } from '../../../shared/bus.js';

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { token, user } = await api('/auth/login', {
        method: 'POST',
        body: { username, password },
      });
      setAuth(token, user);
      bus.emit(EVENTS.LOGIN, user);
      navigate('/');
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
        {submitting ? '登录中...' : '登录'}
      </button>

      <div className="muted" style={{ marginTop: '16px' }}>
        还没有账号？
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
