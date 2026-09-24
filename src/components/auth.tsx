"use client";
import type { ReactNode } from "react";
// Authentication is enforced by the selected API. Local mode uses a per-browser cookie.
export function AuthGate({ children }: { children: ReactNode }) {
  return children;
}
