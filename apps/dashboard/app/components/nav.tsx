import Link from 'next/link';

const links = [
  ['/', 'Vehicle Lookup'],
  ['/residents', 'Residents'],
  ['/workers', 'Workers'],
  ['/services', 'Services'],
  ['/carpool', 'Carpool'],
  ['/broadcast', 'Broadcast'],
  ['/analytics', 'Analytics'],
];

export function Nav() {
  return (
    <nav className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap gap-1 px-6 py-3 text-sm">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="rounded px-3 py-2 hover:bg-zinc-100">
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
