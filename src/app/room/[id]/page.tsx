import { notFound } from "next/navigation";
import RoomClient from "@/components/RoomClient";
import { getRoom } from "@/lib/rooms";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = getRoom(id);
  if (!room) notFound();
  return <RoomClient room={room} />;
}
