import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/contexts/ToastContext";
import { ToastContainer } from "@/components/Toast";
import { OfflineBanner } from "@/components/OfflineBanner";

export const metadata: Metadata = {
  title: "AI Image Prompts - AI 图像提示词库",
  description:
    "发现和使用最佳 AI 图像生成提示词，包含 Midjourney、Stable Diffusion 等平台的精选提示词",
  keywords:
    "AI, prompts, 提示词, Midjourney, Stable Diffusion, AI绘画, 图像生成",
  authors: [{ name: "AI Prompts" }],
  openGraph: {
    title: "AI Image Prompts - AI 图像提示词库",
    description: "发现和使用最佳 AI 图像生成提示词",
    type: "website",
    locale: "zh_CN",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <body className="font-sans antialiased">
        <ToastProvider>
          <OfflineBanner />
          {children}
          <ToastContainer />
        </ToastProvider>
      </body>
    </html>
  );
}
