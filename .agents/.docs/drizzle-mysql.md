# Drizzle ORM - MySQL

# Drizzle <> MySQL

To use Drizzle with a MySQL database, you should use the `mysql2` driver

According to the **[official website](https://github.com/sidorares/node-mysql2)**, `mysql2` is a MySQL client for Node.js with focus on performance.

Drizzle ORM natively supports `mysql2` with `drizzle-orm/mysql2` package.

#### Step 1 - Install packages[](#step-1---install-packages)

npm

yarn

pnpm

bun

```
npm i drizzle-orm mysql2
npm i -D drizzle-kit
```

```
yarn add drizzle-orm mysql2
yarn add -D drizzle-kit
```

```
pnpm add drizzle-orm mysql2
pnpm add -D drizzle-kit
```

```
bun add drizzle-orm mysql2
bun add -D drizzle-kit
```

#### Step 2 - Initialize the driver and make a query[](#step-2---initialize-the-driver-and-make-a-query)

mysql2

mysql with config

```
import { drizzle } from "drizzle-orm/mysql2";

const db = drizzle(process.env.DATABASE_URL);

const response = await db.select().from(...)
```

```
import { drizzle } from "drizzle-orm/mysql2";

// You can specify any property from the mysql2 connection options
const db = drizzle({ connection:{ uri: process.env.DATABASE_URL }});

const response = await db.select().from(...)
```

If you need to provide your existing driver:

Client connection

Pool connection

```
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection({
  host: "host",
  user: "user",
  database: "database",
  ...
});

const db = drizzle({ client: connection });
```

```
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const poolConnection = mysql.createPool({
  host: "host",
  user: "user",
  database: "database",
  ...
});

const db = drizzle({ client: poolConnection });
```

IMPORTANT

For the built in `migrate` function with DDL migrations we and drivers strongly encourage you to use single `client` connection.

For querying purposes feel free to use either `client` or `pool` based on your business demands.

#### What’s next?[](#whats-next)

**Manage schema**

[Drizzle Schema](/docs/sql-schema-declaration) [PostgreSQL data types](/docs/column-types/pg) [Indexes and Constraints](/docs/indexes-constraints) [Database Views](/docs/views) [Database Schemas](/docs/schemas) [Sequences](/docs/sequences) [Extensions](/docs/extensions/pg)

**Query data**

[Relational Queries](/docs/rqb) [Select](/docs/select) [Insert](/docs/insert) [Update](/docs/update) [Delete](/docs/delete) [Filters](/docs/operators) [Joins](/docs/joins) [sql\`\` operator](/docs/sql)

## Embedded Content