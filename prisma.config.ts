import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  // main entry for your schema
  schema: 'prisma/schema.prisma',

  // where migrations should be generated
  migrations: {
    path: 'prisma/migrations',
  },

  // The database URL
  datasource: {
    url: 'postgresql://neondb_owner:npg_iFrMNz2svW8f@ep-broad-leaf-a16ex7r6-pooler.ap-southeast-1.aws.neon.tech/rest-api?uselibpqcompat=true&sslmode=require',
  },
});
