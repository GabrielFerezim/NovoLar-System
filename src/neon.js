import { neon } from '@neondatabase/serverless';

const connectionString = "postgresql://neondb_owner:npg_F4AMmw9EOhei@ep-lucky-field-axauzii7-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

export const sql = neon(connectionString);
