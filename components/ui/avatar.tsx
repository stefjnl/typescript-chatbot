"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
}

export function Avatar({ src, alt, fallback, className, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold uppercase text-muted-foreground",
        className
      )}
      {...props}
    >
      {src ? (
        <Image fill src={src} alt={alt ?? "avatar"} className="object-cover" />
      ) : (
        <span>{fallback}</span>
      )}
    </div>
  );
}
