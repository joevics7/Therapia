import NavBar from "@/components/NavBar";
import RequireAuth from "@/components/RequireAuth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="appwrap">
      <RequireAuth>{children}</RequireAuth>
      <div className="nav-spacer" aria-hidden="true" />
      <NavBar />
    </div>
  );
}
