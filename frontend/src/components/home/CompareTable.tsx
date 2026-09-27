import { Check, X } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/reui/badge";

type CompareRow = {
  feature: string;
  brand: string;
  others: string;
};

const ROWS: CompareRow[] = [
  {
    feature: "Domain Selection",
    brand: "Massive Pool (More than paid services)",
    others: "Limited (Often < 10)",
  },
  {
    feature: "Direct Link Access",
    brand: "Supported (e.g. /user@domain.com)",
    others: "Not Supported",
  },
  { feature: "Cost", brand: "100% Free", others: "Freemium / Paid" },
  { feature: "Privacy", brand: "No Personal Data", others: "Varies" },
  { feature: "API Access", brand: "Free & Open", others: "Paid / Private" },
];

export function CompareTable() {
  return (
    <section className="w-full">
      <div className="flex flex-col gap-8 py-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <Badge
            variant="primary-light"
            radius="full"
            className="uppercase tracking-[0.25px]"
          >
            Compare
          </Badge>
          <h2 className="text-balance text-3xl font-bold leading-[38px] tracking-[-0.4px]">
            <span className="text-brand-gradient">{BRAND_NAME}</span> vs Others
          </h2>
        </div>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[680px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Feature</TableHead>
                  <TableHead>{BRAND_NAME}</TableHead>
                  <TableHead>Other Services</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROWS.map((row) => (
                  <TableRow key={row.feature}>
                    <TableCell className="font-bold">{row.feature}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 font-semibold">
                        <Check className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
                        {row.brand}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <X className="h-4 w-4 shrink-0" />
                        {row.others}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </section>
  );
}
