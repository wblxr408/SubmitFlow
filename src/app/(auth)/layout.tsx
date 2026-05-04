/**
 * 认证路由组布局
 * 不显示侧边栏
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
