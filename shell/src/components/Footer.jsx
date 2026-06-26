/**
 * 文件：Footer.jsx
 * 所属模块：shell（主应用底部页脚组件）
 * 核心职责：展示项目说明文字与各微前端端口信息。这是一个纯展示组件，
 *           没有状态、没有副作用，给定输入就输出固定 UI。
 *
 * 关键概念：
 * - 纯展示组件（无状态组件）：只负责“长什么样”，不涉及数据逻辑，
 *   便于复用与测试。整个函数直接 return JSX，简洁直观。
 */

// 页脚组件：展示项目名、技术栈说明以及各服务端口
export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <p>ShopMFE · 基于 Module Federation 的微前端电商演示</p>
        {/* 列出所有微前端与后端端口，方便调试时对照 */}
        <p className="footer-sub">
          Shell(5173) · Products(5174) · Cart(5175) · Auth(5176) · Order(5177) · API(3001)
        </p>
      </div>
    </footer>
  );
}
