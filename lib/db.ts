import mysql from "mysql2/promise";

const globalForDb = globalThis as unknown as { db?: mysql.Pool };

const isNew = !globalForDb.db;

export const db =
  globalForDb.db ??
  mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

if (isNew) {
  db.getConnection()
    .then((connection) => {
      console.log("Connected to MySQL");
      connection.release();
    })
    .catch((err) => {
      console.log(" MySQL connection failed:", err);
    });
}

if (process.env.NODE_ENV !== "production") globalForDb.db = db;