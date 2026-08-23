"use client";

import { useParams } from "next/navigation";
import { ResourceTable } from "@/components/resource/resource-table";
import { getResource } from "@/lib/resources";

export default function ResourceListPage() {
  const params = useParams<{ resource: string }>();
  const cfg = getResource(params.resource);

  if (!cfg) {
    return <p className="py-12 text-center text-muted-foreground">Unknown resource.</p>;
  }

  return <ResourceTable cfg={cfg} />;
}
