"use client";

import MicrocycleConfig from "@/components/trainer/microcycle/microcycle-config";

interface Props {
  clientId: string;
}

export default function MicrocycleTab({ clientId }: Props) {
  return <MicrocycleConfig clientId={clientId} />;
}
