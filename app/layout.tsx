import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Manhwa Video Production Studio',
  description: 'AI-powered Manhwa & Anime recap video production studio with strict narration sync, timestamped prompt importer, reference manager, cinematic motion effects, and video rendering.',
  openGraph: {
    title: 'Manhwa Video Production Studio',
    description: 'AI-powered Manhwa & Anime recap video production studio with strict narration sync, timestamped prompt importer, reference manager, cinematic motion effects, and video rendering.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Manhwa Video Production Studio',
    description: 'AI-powered Manhwa & Anime recap video production studio with strict narration sync, timestamped prompt importer, reference manager, cinematic motion effects, and video rendering.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (typeof window !== 'undefined' && window.fetch) {
                  var _origFetch = window.fetch;
                  Object.defineProperty(window, 'fetch', {
                    get: function() { return _origFetch; },
                    set: function(val) { _origFetch = val; },
                    configurable: true,
                    enumerable: true
                  });
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
