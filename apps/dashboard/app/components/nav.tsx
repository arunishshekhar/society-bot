import Link from 'next/link';
import { Button } from '@/components/ui/button';

const links = [
  ['/', 'Vehicle Lookup'],
  ['/residents', 'Residents'],
  ['/workers', 'Workers'],
  ['/services', 'Services'],
  ['/carpool', 'Carpool'],
  ['/broadcast', 'Broadcast'],
  ['/faq', 'FAQs'],
  ['/analytics', 'Analytics'],
];

export function Nav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-7xl items-center px-4">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block">
              Society Bot Admin
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="transition-colors hover:text-foreground/80 text-foreground/60"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
