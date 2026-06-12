import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AR Brochure',
  description: 'Point your camera at the brochure to watch it come alive',
  viewport: 'width=device-width, initial-scale=1, user-scalable=no',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* MindAR + A-Frame must load before the page renders */}
        <script
          src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js"
          defer={false}
        />
      </head>
      <body className="bg-black overflow-hidden">
        {children}
      </body>
    </html>
  )
}
