import './globals.css';
import { Nav } from './components/nav';
import { Toaster } from '@/components/ui/sonner';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="en" className={cn("dark font-sans", geist.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Nav />
        {children}
        <Toaster richColors />
      </body>
    </html>
  );
}
