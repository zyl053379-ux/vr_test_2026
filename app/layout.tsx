import type { Metadata } from "next";
import "./site.css";
import "./expert.css";

export const metadata: Metadata = {
  title: "叙事观察室 · VR作品专家评审",
  description: "VR交互叙事作品专家评审与研究管理平台",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
