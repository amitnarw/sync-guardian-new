"use client";

import { useParams } from "next/navigation";
import { ResourceForm } from "@/components/resource/resource-form";
import { getResource } from "@/lib/resources";

export default function ResourceEditPage() {
  const params = useParams<{ resource: string; id: string }>();
  const cfg = getResource(params.resource);

  if (!cfg || !cfg.canEdit) {
    return <p className="py-12 text-center text-muted-foreground">Editing is not available for this resource.</p>;
  }

  return <ResourceForm cfg={cfg} mode="edit" id={params.id} />;
}
