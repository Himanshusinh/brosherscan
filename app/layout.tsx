import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'AR Brochure',
  description: 'Point your camera at the brochure to watch it come alive',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="preload" href="/vendor/aframe.min.js" as="script" />
        <link rel="preload" href="/vendor/mindar-image-aframe.prod.js" as="script" />
        <link rel="preload" href="/targets/target.mind" as="fetch" crossOrigin="anonymous" />
        <Script src="/vendor/aframe.min.js" strategy="beforeInteractive" />
        <Script src="/vendor/mindar-image-aframe.prod.js" strategy="beforeInteractive" />
      </head>
      <body className="bg-black overflow-hidden m-0 p-0">
        {children}
      </body>
    </html>
  )
}
