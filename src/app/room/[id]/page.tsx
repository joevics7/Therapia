import { LiveRoomEntry } from "@/components/RoomEntry";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveRoomEntry id={id} />;
}
