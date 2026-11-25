import mysql from "mysql2/promise";

const globalForDb = globalThis as unknown as { db?: mysql.Pool };

export const db =
  globalForDb.db ??
  mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA.replaceAll("\\n", "\n"), rejectUnauthorized: true, verifyIdentity: true } : undefined,
  });

if (process.env.NODE_ENV !== "production") globalForDb.db = db;