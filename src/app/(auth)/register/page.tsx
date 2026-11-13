import { AuthForm } from "@/components/dashboard/AuthForm";

export const metadata = { title: "Daftar" };

export default function RegisterPage() {
  return (
    <main className="min-h-screen grid place-items-center p-4">
      <AuthForm mode="register" demo={false} />
    </main>
  );
}
