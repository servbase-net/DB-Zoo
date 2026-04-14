import { MySqlProvider } from "@/lib/db/providers/mysql";

export class MariaDbProvider extends MySqlProvider {
  engine = "mariadb" as const;
}
