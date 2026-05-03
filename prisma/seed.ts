import { prisma } from "../server/db";
import { seedDatabase } from "../server/seedData";

await seedDatabase(prisma);
await prisma.$disconnect();
