// Builder de la notificación de campana del ENTRENADOR cuando un cliente sube
// un video de entrenamiento. Se inserta desde la ruta de upload — la URL del
// video se acuña exactamente una vez ahí (timestamp + upsert:false), así que
// un upload = a lo sumo una notificación, sin registro extra de "ya avisado".
//
// Mismas convenciones que chat-notification.ts: tenant_slug guarda el SLUG,
// client_id NOT NULL, metadata.audience decide qué campana la muestra. El
// campo `link` lo navega el dropdown del trainer con router.push.

export interface VideoUploadNotificationRow {
  tenant_slug: string;
  client_id: number;
  trainer_id: string;
  type: "video_upload";
  title: string;
  message: string;
  icon: string;
  link: string;
  metadata: { audience: "trainer"; action: "open_client_videos" };
}

export function buildVideoUploadNotificationRow(args: {
  tenantSlug: string;
  clientId: number;
  trainerId: string;
  clientName: string;
}): VideoUploadNotificationRow {
  const name = args.clientName.trim();

  return {
    tenant_slug: args.tenantSlug,
    client_id: args.clientId,
    trainer_id: args.trainerId,
    type: "video_upload",
    title: "Nuevo video para revisar",
    message:
      name === ""
        ? "Un cliente subió un video de entrenamiento"
        : `${name} subió un video de entrenamiento`,
    icon: "solar:videocamera-record-broken",
    link: `/trainer/dashboard/clients/${args.clientId}?tab=training&sub=videos`,
    metadata: { audience: "trainer", action: "open_client_videos" },
  };
}
