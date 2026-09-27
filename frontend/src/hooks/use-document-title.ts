import { useEffect } from "react";
import { BRAND_NAME } from "@/lib/brand";

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | ${BRAND_NAME}`;
  }, [title]);
}
