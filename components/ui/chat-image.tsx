"use client";

import { useState } from "react";
import Image from "next/image";
import { ExternalLink, Maximize2, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatImageProps {
  src: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  aspectRatio?: "square" | "video" | "auto";
}

export function ChatImage({
  src,
  alt = "Chat image",
  width,
  height,
  className,
  aspectRatio = "auto",
}: ChatImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Compute style overrides for explicit width/height if provided
  const styleObj: React.CSSProperties = {};
  if (width) styleObj.maxWidth = typeof width === "number" ? `${width}px` : width;
  if (height) styleObj.maxHeight = typeof height === "number" ? `${height}px` : height;

  if (error || !src) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-2.5 text-xs text-muted-foreground my-1.5 max-w-xs">
        <ImageOff className="size-4 shrink-0 text-muted-foreground/60" />
        <span className="truncate italic">{alt || "Image failed to load"}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative inline-block overflow-hidden rounded-xl border border-border/50 bg-muted/40 transition-all my-1.5 shadow-2xs hover:shadow-md max-w-full",
        aspectRatio === "square" && "aspect-square w-36",
        aspectRatio === "video" && "aspect-video w-full max-w-md",
        className
      )}
      style={styleObj}
    >
      {/* Loading Skeleton */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/60 animate-pulse">
          <span className="text-[10px] text-muted-foreground font-mono">Loading image...</span>
        </div>
      )}

      {/* Render Image */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoading(false)}
        onError={() => setError(true)}
        className={cn(
          "h-auto max-h-64 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] cursor-pointer",
          loading ? "opacity-0" : "opacity-100"
        )}
        onClick={() => window.open(src, "_blank")}
      />

      {/* Hover Overlay with Lightbox / External Link hint */}
      <div
        onClick={() => window.open(src, "_blank")}
        className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/60 via-transparent to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 cursor-pointer pointer-events-auto"
      >
        <span className="truncate text-[10px] font-medium text-white/90 max-w-[80%]">
          {alt !== "Chat image" ? alt : "View full image"}
        </span>
        <div className="flex size-6 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-xs">
          <Maximize2 className="size-3" />
        </div>
      </div>
    </div>
  );
}
