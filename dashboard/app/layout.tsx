import type { Metadata } from 'next';
import { Bricolage_Grotesque, Hanken_Grotesk } from 'next/font/google';
import './globals.css';
import { Shell } from '../components/shell';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-display-next',
  display: 'swap',
});

const sans = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-next',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Job Agent — Dashboard',
  description: 'Autonomous AI job application pipeline',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
