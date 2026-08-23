"use client";

import { useParams } from "next/navigation";
import { ShowView } from "@/components/resource/show-view";
import { getResource } from "@/lib/resources";

export default function ResourceShowPage() {
  const params = useParams<{ resource: string; id: string }>();
  const cfg = getResource(params.resource);

  if (!cfg) {
    return <p className="py-12 text-center text-muted-foreground">Unknown resource.</p>;
  }

  return <ShowView cfg={cfg} id={params.id} />;
}
