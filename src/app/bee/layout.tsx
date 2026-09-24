import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Clash of Schmels",
  description: "Пчелиная колония, живая логистика и четыре эпохи индустрии.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
