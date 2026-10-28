import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingIncludes: {
    "/api/policy-check": ["./data/uo-policies/*.md", "./data/uo-policies/reviewed-ocr/**/*"],
    "/api/policy-pairs": ["./data/uo-policies/*.md"],
  },
};

export default nextConfig;
