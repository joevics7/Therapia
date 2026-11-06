import NavBar from "@/components/NavBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div style={{ height: 76 }} aria-hidden="true" />
      <NavBar />
    </>
  );
}
