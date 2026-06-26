// 跨微前端通信总线（window 单例，所有微前端共享同一实例）
function createBus() {
  const listeners = {};
  return {
    on(event, cb) {
      (listeners[event] ||= []).push(cb);
      return () => {
        listeners[event] = (listeners[event] || []).filter((c) => c !== cb);
      };
    },
    emit(event, data) {
      (listeners[event] || []).forEach((cb) => cb(data));
    },
  };
}

export const bus = (window.__shopBus ||= createBus());

export const EVENTS = {
  CART_CHANGED: 'cart:changed',
  LOGIN: 'auth:login',
  LOGOUT: 'auth:logout',
};
