# Local Database

Use Docker Compose for local PostgreSQL development.

1. Copy the bot env example:

   ```sh
   cp apps/bot/.env.example apps/bot/.env
   ```

2. Start PostgreSQL:

   ```sh
   pnpm db:up
   ```

3. Apply Prisma migrations:

   ```sh
   pnpm db:migrate:init
   ```

4. Optional Prisma Studio:

   ```sh
   pnpm db:studio
   ```

For later schema changes, use `pnpm db:migrate` and enter a descriptive migration name when prompted.

For Railway deployment, replace `DATABASE_URL` in the deployed environment with the Railway PostgreSQL connection string. No code change is needed.
