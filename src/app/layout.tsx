import type { Metadata, Viewport } from 'next';
import { Outfit, Playfair_Display } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'PostBoek.com | Orchid Prism Social Network',
    template: '%s | PostBoek.com',
  },
  description: 'PostBoek.com is a prismatic social platform for creators with immersive feeds, reels, AI-assisted creation, and live chat.',
  keywords: ['PostBoek.com', 'social network', 'creator platform', 'AI creator', 'reels', 'community'],
  applicationName: 'PostBoek.com',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'PostBoek.com | Orchid Prism Social Network',
    description: 'PostBoek.com is a modern social experience with feed discovery, short-form video, creator tools, and profile-centric community.',
    siteName: 'PostBoek.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PostBoek.com | Orchid Prism Social Network',
    description: 'PostBoek.com is a modern social experience with feed discovery, short-form video, creator tools, and profile-centric community.',
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
    <html lang="en">
      <body className={`${outfit.variable} ${playfair.variable} bg-[#fcfaff] text-slate-950 antialiased`}>
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(at_0%_0%,_rgba(124,58,237,0.15)_0px,_transparent_50%),_radial-gradient(at_100%_0%,_rgba(219,39,119,0.15)_0px,_transparent_50%)]"></div>
          <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-fuchsia-100/30 blur-[120px]"></div>
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SocialMediaPosting',
              'headline': 'PostBoek.com - Prismatic Social Network',
              'description': 'PostBoek.com is a modern social experience with feed discovery, reels, and AI creator tools.',
              'author': {
                '@type': 'Organization',
                'name': 'PostBoek.com Team',
              },
              'publisher': {
                '@type': 'Organization',
                'name': 'PostBoek.com',
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
