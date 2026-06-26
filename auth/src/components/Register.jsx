import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setAuth } from '../../../shared/api.js';
import { bus, EVENTS } from '../../../shared/bus.js';

function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { token, user } = await api('/auth/register', {
        method: 'POST',
        body: { username, password, name },
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
