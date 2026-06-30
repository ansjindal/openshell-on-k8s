import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  // node-pty is a native addon used only by the custom server (server.mjs) at runtime.
  // @grpc/* are used only by the embedded console BFF (server components / route
  // handlers) and must never be bundled into client code.
  serverExternalPackages: ["node-pty", "@grpc/grpc-js", "@grpc/proto-loader"],
};

const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm"],
    rehypePlugins: ["rehype-slug"],
  },
});

export default withMDX(nextConfig);
