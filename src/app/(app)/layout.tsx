import NavBar from "@/components/NavBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="appwrap">
      {children}
      <div className="nav-spacer" aria-hidden="true" />
      <NavBar />
    </div>
  );
}
