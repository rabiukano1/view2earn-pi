import Link from "next/link";

export default function NotFound() {
  return (
    <div className="pi-centered" style={{ textAlign: "center", padding: "60px 20px" }}>
      <div className="pi-card pi-card-glass" style={{ maxWidth: 420, width: "100%", padding: 32 }}>
        <h1 style={{ fontSize: 48, marginBottom: 8 }}>404</h1>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Page Not Found</h2>
        <p className="pi-muted" style={{ marginBottom: 20 }}>
          The page you are looking for does not exist or has been moved.
        </p>
        <Link href="/home" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
          Back to Home →
        </Link>
      </div>
    </div>
  );
}
