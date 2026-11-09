import { runMigrations } from "@agent-native/core/db";

import { MIGRATIONS, MIGRATIONS_TABLE } from "../db/migrations.js";

export default runMigrations(MIGRATIONS, { table: MIGRATIONS_TABLE });
