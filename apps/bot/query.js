const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const triggers = await prisma.$queryRawUnsafe(`
    SELECT tgname, relname 
    FROM pg_trigger 
    JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid 
    WHERE relname IN ('FoundItem', 'LostItem');
  `);
  console.log(triggers);
}
main().finally(() => prisma.$disconnect());
