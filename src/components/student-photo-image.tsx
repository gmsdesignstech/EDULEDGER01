"use client";

import Image from "next/image";
import { useState } from "react";

export function StudentPhotoImage({ studentId, name, size = 80, className = "" }: { studentId: string; name: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "ST";
  if (failed) return <span role="img" aria-label={`${name} photo unavailable`} className={`grid shrink-0 place-items-center rounded-2xl bg-violet-100 font-black text-violet-700 ${className}`} style={{ width: size, height: size }}>{initials}</span>;
  return <Image src={`/api/students/${encodeURIComponent(studentId)}/photo`} unoptimized width={size} height={size} alt={`${name} photograph`} className={className} onError={() => setFailed(true)} />;
}
