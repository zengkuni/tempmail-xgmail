import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { useTable, type ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/reui/badge";
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import {
  DataGrid,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import type { DomainRow } from "./types";

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge variant="success-light" radius="full" className="uppercase">
      Active
    </Badge>
  ) : (
    <Badge variant="secondary" radius="full" className="uppercase">
      Inactive
    </Badge>
  );
}

function MxBadge({ mxValid }: { mxValid: boolean | null }) {
  if (mxValid === null) {
    return (
      <Badge variant="warning-light" radius="full" className="uppercase">
        Unknown
      </Badge>
    );
  }
  return mxValid ? (
    <Badge variant="success-light" radius="full" className="uppercase">
      Valid
    </Badge>
  ) : (
    <Badge variant="warning-light" radius="full" className="uppercase">
      Invalid
    </Badge>
  );
}

const columns: ColumnDef<DataGridFeatures, DomainRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Domain" />
    ),
    cell: ({ row }) => row.original.name,
  },
  {
    accessorKey: "active",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => <StatusBadge active={row.original.active} />,
  },
  {
    id: "mx",
    accessorFn: (row) =>
      row.mxValid === null ? "unknown" : row.mxValid ? "valid" : "invalid",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="MX" />
    ),
    cell: ({ row }) => <MxBadge mxValid={row.original.mxValid} />,
  },
  {
    id: "added",
    accessorFn: (row) => new Date(row.added).getTime(),
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Added" />
    ),
    cell: ({ row }) => row.original.added,
  },
  {
    id: "expires",
    accessorFn: (row) =>
      row.expiresAt ? new Date(row.expiresAt).getTime() : 0,
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Expires" />
    ),
    cell: ({ row }) =>
      row.original.expiresAt
        ? new Date(row.original.expiresAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "-",
  },
];

export function DomainInventory({
  rows,
  onRefresh,
  refreshing,
}: {
  rows: DomainRow[];
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [query, setQuery] = useState("");

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((row) => row.name.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const table = useTable({
    features: dataGridFeatures,
    data,
    columns,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });

  // ReUI's useTable (TanStack v9 semantics) returns a NEW table instance on
  // every state change, so keying this effect on `table` resets the page on
  // every render. Reset only when the search query itself changes.
  const lastQuery = useRef(query);
  useEffect(() => {
    if (lastQuery.current === query) return;
    lastQuery.current = query;
    table.setPageIndex(0);
  });

  return (
    <Frame>
      <FramePanel>
        <FrameHeader className="mb-4 flex-row flex-wrap items-center justify-between gap-3 border-b border-border">
          <FrameTitle className="text-lg font-bold">
            Domain Inventory
          </FrameTitle>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-48 sm:flex-none">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search domain"
                aria-label="Search domain"
                className="w-full pl-8 sm:w-56"
              />
            </div>
            <Button variant="secondary" onClick={onRefresh}>
              <RefreshCw className={refreshing ? "animate-spin" : undefined} />
              Refresh
            </Button>
          </div>
        </FrameHeader>
        <DataGrid table={table} recordCount={data.length}>
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
          <DataGridPagination />
        </DataGrid>
      </FramePanel>
    </Frame>
  );
}
