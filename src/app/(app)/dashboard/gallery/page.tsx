import { currentEventPage } from "@/server/auth";
import { GalleryManager } from "@/components/dashboard/GalleryManager";
import { GALLERY_LIMIT, listGallery } from "@/server/media";

export const dynamic = "force-dynamic";
export const metadata = { title: "Galeri Foto" };

export default async function GalleryPage() {
  const { event } = await currentEventPage();
  const photos = await listGallery(event.id);
  return <GalleryManager eventId={event.id} photos={photos.map((p) => ({ id: p.id }))} limit={GALLERY_LIMIT} />;
}
