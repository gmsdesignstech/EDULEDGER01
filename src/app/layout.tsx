import type { Metadata,Viewport } from "next";import "./globals.css";import {ThemeProvider} from "@/components/theme";import{getSiteOrigin}from"@/lib/site-url";import {NotificationPushManager} from "@/components/notification-push-manager";import {PwaInstallPrompt} from "@/components/pwa-install-prompt";
const siteUrl=getSiteOrigin(),title="EduLedger – School Management Software | Complete School ERP",description="EduLedger is a modern school management software and school ERP for managing students, staff, attendance, fees, exams, timetable, communication and school operations.";
export const metadata:Metadata={
  metadataBase:new URL(siteUrl),
  title:{default:title,template:"%s | EduLedger"},
  description,
  manifest:"/manifest.webmanifest",
  appleWebApp:{capable:true,statusBarStyle:"default",title:"EduLedger"},
  formatDetection:{telephone:false},
  icons:{icon:"/icons/icon-192.png",apple:"/icons/apple-touch-icon.png"},
  openGraph:{title,description,url:siteUrl,siteName:"EduLedger",images:[{url:"/icons/icon-512.png",alt:"EduLedger school management software"}],type:"website"},
  twitter:{card:"summary_large_image",title,description,images:["/icons/icon-512.png"]}
};
export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover",themeColor:[{media:"(prefers-color-scheme: light)",color:"#f8faff"},{media:"(prefers-color-scheme: dark)",color:"#07111f"}]};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning><body><ThemeProvider>{children}<NotificationPushManager /><PwaInstallPrompt /></ThemeProvider></body></html>}
