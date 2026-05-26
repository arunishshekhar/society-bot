import './globals.css';
import { Nav } from './components/nav';

export const metadata = {
  title: 'Society Bot Admin',
  description: 'Admin dashboard for Society Bot',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
