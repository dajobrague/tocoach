export default function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Simple layout wrapper for client routes
    // Individual pages handle their own authentication checks
    // Bottom nav is conditionally rendered in authenticated pages

    return <>{children}</>;
}

