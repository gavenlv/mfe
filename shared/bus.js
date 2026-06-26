/**
 * 文件：bus.js
 * 所属模块：shared（所有微前端共用的共享模块）
 * 核心职责：提供一个“跨微前端通信”的事件总线（EventBus），让主应用与各子应用
 *           之间能够解耦通信（如购物车数量变化、登录/登出通知）。
 *
 * 关键概念——为什么微前端需要事件总线？
 *   微前端把一个应用拆成多个独立构建、独立部署的子应用。它们之间没有直接 import
 *   关系，不能像普通模块那样互相调用函数。但业务上又需要联动（例如：商品子应用
 *   加购后，主应用 Header 的购物车角标要更新）。
 *   “发布订阅（pub/sub）”模式就是解法：发送方只管 emit 事件，不关心谁在听；
 *   接收方只管 on 订阅，不关心谁在发。两者通过事件名解耦。
 *
 * 关键概念——window 单例：
 *   各子应用虽然独立打包，但运行时都在同一个浏览器 window 下。把总线实例挂在
 *   window.__shopBus 上，所有微前端拿到的就是同一个对象，从而能互相收发消息。
 *
 * 关键概念——为什么用 ||= 保证全局唯一？
 *   ||= 是逻辑或赋值：window.__shopBus ||= createBus() 等价于
 *   “如果 window.__shopBus 已存在就用它，否则新建一个”。
 *   这样无论总线模块被加载几次（主应用一次、每个子应用各一次），都只会创建
 *   一个实例，保证全局唯一、事件能互通。
 *
 * 说明：本文件与 shell/src/bus.js 内容一致，作为 shared 模块供子应用直接引入，
 *       保证所有微前端使用的是同一套事件协议与同一个 window 实例。
 */

// 跨微前端通信总线（window 单例，所有微前端共享同一实例）
function createBus() {
  // listeners 是一个“事件名 -> 回调函数数组”的映射表
  const listeners = {};
  return {
    // on：订阅事件。把回调塞进对应事件名下的数组里，返回一个“取消订阅”函数。
    // 返回取消函数是为了在组件卸载时清理监听，避免内存泄漏与重复触发。
    on(event, cb) {
      // ||= 保证 listeners[event] 数组存在后再 push
      (listeners[event] ||= []).push(cb);
      return () => {
        listeners[event] = (listeners[event] || []).filter((c) => c !== cb);
      };
    },
    // emit：发布事件。遍历该事件下所有回调并调用，把 data 传给它们。
    emit(event, data) {
      (listeners[event] || []).forEach((cb) => cb(data));
    },
  };
}

// 挂到 window 上实现全局单例。 ||= 确保只创建一次，所有微前端共享同一实例。
export const bus = (window.__shopBus ||= createBus());

// 事件名常量
// 用常量而不是字符串字面量，可以避免拼写错误，也方便统一管理事件协议。
// 主应用与各子应用都引用同一组常量，保证事件名一致。
export const EVENTS = {
  CART_CHANGED: 'cart:changed',
  LOGIN: 'auth:login',
  LOGOUT: 'auth:logout',
};
