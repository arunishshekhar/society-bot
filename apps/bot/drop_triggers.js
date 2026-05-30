const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS found_search_vector_trigger ON "FoundItem";`);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS lost_search_vector_trigger ON "LostItem";`);
  await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS found_search_vector_update CASCADE;`);
  await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS lost_search_vector_update CASCADE;`);
  console.log("Triggers and functions dropped successfully.");
}
main().finally(() => prisma.$disconnect());
