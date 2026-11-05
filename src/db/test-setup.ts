import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Creates the test database if needed, then applies migrations. */
export default async function setup() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const name = url.pathname.slice(1);
  if (!name.endsWith("_test")) throw new Error("Refusing to run against a non-test database");

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.href, { max: 1, onnotice: () => {} });
  const found = await admin`select 1 from pg_database where datname = ${name}`;
  if (found.length === 0) await admin.unsafe(`create database ${name}`);
  await admin.end();

  const client = postgres(url.href, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
}
