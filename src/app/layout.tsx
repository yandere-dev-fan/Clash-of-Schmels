import "./globals.css";
export const metadata = {
  title: "Clash of Schmels",
  description:
    "Пчелиная фабрика: четыре эпохи, живая логистика и случайные долины.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
