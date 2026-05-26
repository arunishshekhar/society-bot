const fs = require('fs');

const files = [
  'apps/dashboard/app/residents/page.tsx',
  'apps/dashboard/app/workers/page.tsx',
  'apps/dashboard/app/services/page.tsx',
  'apps/dashboard/app/carpool/page.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace import
  if (!content.includes('buttonVariants')) {
    content = content.replace(/import { Button } from '@\/components\/ui\/button';/g, "import { Button, buttonVariants } from '@/components/ui/button';");
  }

  // Replace <Button ... asChild>\n  <Link href="...">Text</Link>\n</Button>
  content = content.replace(/<Button([^>]*)asChild>\s*<Link([^>]*)>(.*?)<\/Link>\s*<\/Button>/gs, (match, buttonAttrs, linkAttrs, innerText) => {
    let variant = 'default';
    let size = 'default';
    
    const variantMatch = buttonAttrs.match(/variant="([^"]+)"/);
    if (variantMatch) variant = variantMatch[1];
    
    const sizeMatch = buttonAttrs.match(/size="([^"]+)"/);
    if (sizeMatch) size = sizeMatch[1];
    
    return `<Link ${linkAttrs} className={buttonVariants({ variant: "${variant}", size: "${size}" })}>${innerText}</Link>`;
  });
  
  fs.writeFileSync(file, content);
}
