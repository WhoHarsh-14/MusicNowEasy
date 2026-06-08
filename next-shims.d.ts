// Type shims for Next.js 16 (which ships without separate .d.ts files)
declare module "next" {
  export interface NextConfig {
    experimental?: {
      serverActions?: {
        bodySizeLimit?: string;
      };
    };
    images?: {
      domains?: string[];
    };
    [key: string]: unknown;
  }
  export interface Metadata {
    title?: string;
    description?: string;
    keywords?: string[];
    openGraph?: {
      title?: string;
      description?: string;
      type?: string;
    };
    [key: string]: unknown;
  }
}

declare module "next/font/google" {
  interface FontOptions {
    subsets: string[];
    variable?: string;
    display?: string;
    weight?: string | string[];
  }
  interface FontResult {
    className: string;
    variable: string;
    style: { fontFamily: string };
  }
  export function Inter(options: FontOptions): FontResult;
  export function Outfit(options: FontOptions): FontResult;
}

declare module "next/image" {
  import React from "react";
  interface ImageProps {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
    priority?: boolean;
    fill?: boolean;
    style?: React.CSSProperties;
    [key: string]: unknown;
  }
  const Image: React.FC<ImageProps>;
  export default Image;
}

declare module "next/server" {
  export class NextRequest extends Request {
    nextUrl: URL;
  }
  export class NextResponse extends Response {
    static json(body: unknown, init?: ResponseInit): NextResponse;
  }
}

declare module "ffmpeg-static" {
  const path: string | null;
  export default path;
}

declare module "yt-dlp-exec" {
  export interface Options {
    [key: string]: any;
  }
  function youtubedl(url: string, options?: Options): Promise<any>;
  export default youtubedl;
}
