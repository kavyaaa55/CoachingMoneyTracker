type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "right";
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
};

/**
 * A table on wide screens, which scrolls inside its box if the columns do not fit beside
 * the sidebar. On a phone, each row becomes a stack of labelled lines.
 */
export function DataTable<T>({ columns, rows, rowKey }: Props<T>) {
  return (
    <div className="overflow-x-auto rounded-md border border-divider bg-surface">
      <table className="block w-full md:table">
        <thead className="hidden md:table-header-group">
          <tr>
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={`border-b border-divider px-4 py-3 text-sm font-medium ${
                  column.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="block divide-y divide-divider md:table-row-group">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="block p-4 md:table-row md:p-0">
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={`flex justify-between gap-4 py-1 md:table-cell md:h-12 md:px-4 md:py-2 ${
                    column.align === "right" ? "md:text-right" : ""
                  }`}
                >
                  <span className="text-sm text-muted md:hidden">{column.header}</span>
                  <span className="text-right md:text-inherit">{column.cell(row)}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
