-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- HAND-EDITED: STAFF no longer exists in the Role enum. Prisma's generated diff
-- copies the column verbatim, which would leave rows holding a value the client
-- cannot decode — SQLite stores enums as plain TEXT, so this fails at read time
-- rather than at migration time, which is worse.
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "passwordHash", "role")
SELECT "createdAt", "email", "id", "name", "passwordHash",
       CASE "role" WHEN 'STAFF' THEN 'EMPLOYEE' ELSE "role" END
FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

