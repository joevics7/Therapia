import NavBar from "@/components/NavBar";
import NeedsGate from "@/components/NeedsGate";
import RequireAuth from "@/components/RequireAuth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="appwrap">
      <RequireAuth><NeedsGate />{children}</RequireAuth>
      <div className="nav-spacer" aria-hidden="true" />
      <NavBar />
    </div>
  );
}
