import { TableBrowser } from "@/components/db-manager/table-browser";

type Props = {
  params: Promise<{ connectionId: string; database: string; schema: string; table: string }>;
};

export default async function TablePage({ params }: Props) {
  const resolved = await params;
  return (
    <TableBrowser
      connectionId={resolved.connectionId}
      database={resolved.database}
      schema={resolved.schema}
      table={resolved.table}
    />
  );
}
