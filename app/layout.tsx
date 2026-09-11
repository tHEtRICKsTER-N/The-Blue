import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ABYSS — Beneath the surface',
  icons: { icon: '/favicon.svg' },
  description: 'A living ocean, waiting to be explored. Swim through coral gardens, encounter marine life, and discover what lies beneath.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
