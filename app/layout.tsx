import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Periodic Test Demo</title>
        <link rel="icon" href="/periodic.png" type="image/png" />
      </head>
      <body>{children}</body>
    </html>
  )
}
