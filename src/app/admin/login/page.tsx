import { redirect } from "next/navigation";

// Rota antiga do login de administrador único: agora o login é por usuário.
export default function OldLoginPage() {
  redirect("/entrar");
}
