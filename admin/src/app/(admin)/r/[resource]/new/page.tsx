"use client";

import { useParams } from "next/navigation";
import { ResourceForm } from "@/components/resource/resource-form";
import { getResource } from "@/lib/resources";

export default function ResourceCreatePage() {
  const params = useParams<{ resource: string }>();
  const cfg = getResource(params.resource);

  if (!cfg || !cfg.canCreate) {
    return <p className="py-12 text-center text-muted-foreground">Creation is not available for this resource.</p>;
  }

  return <ResourceForm cfg={cfg} mode="create" />;
}
