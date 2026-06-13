import type { Metadata, Viewport } from 'next';
import { Outfit, Space_Mono } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-outfit',
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Home | VChat',
    template: '%s | VChat',
  },
  description: 'VChat is a prismatic social platform for creators with immersive feeds, reels, AI-assisted creation, and live chat.',
  keywords: ['VChat', 'social network', 'creator platform', 'AI creator', 'reels', 'community'],
  applicationName: 'VChat',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'Home | VChat',
    description: 'VChat is a modern social experience with feed discovery, short-form video, creator tools, and profile-centric community.',
    siteName: 'VChat',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Home | VChat',
    description: 'VChat is a modern social experience with feed discovery, short-form video, creator tools, and profile-centric community.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#7c3aed',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" style={{ colorScheme: 'light' }}>
      <body className={`${outfit.variable} ${spaceMono.variable} bg-brand-bg text-brand-text antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('postbook_theme');
                  const theme = stored === 'dark' ? 'dark' : 'light';
                  document.documentElement.className = theme;
                  document.documentElement.style.colorScheme = theme;
                } catch (e) {}
              })();
            `
          }}
        />
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(at_0%_0%,_rgba(var(--foreground-rgb),0.08)_0px,_transparent_50%),_radial-gradient(at_100%_0%,_rgba(var(--foreground-rgb),0.06)_0px,_transparent_50%)]"></div>
          <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-brand-secondary/10 blur-[120px]"></div>
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SocialMediaPosting',
              'headline': 'VChat - Prismatic Social Network',
              'description': 'VChat is a modern social experience with feed discovery, reels, and AI creator tools.',
              'author': {
                '@type': 'Organization',
                'name': 'VChat Team',
              },
              'publisher': {
                '@type': 'Organization',
                'name': 'VChat',
                'logo': {
                  '@type': 'ImageObject',
                  'url': `${siteUrl}/logo.png`,
                },
              },
              'datePublished': new Date().toISOString(),
            }),
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
