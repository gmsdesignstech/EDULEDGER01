import { PublicFooter, PublicHeader } from "./public-chrome";

export function PublicPage({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f8faff] text-[#111a35]"><PublicHeader /><main>{children}</main><PublicFooter /></div>;
}
