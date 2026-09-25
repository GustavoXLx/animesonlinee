import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DecoyProfile } from "@/components/chat/DecoyProfile";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — AniStream" },
      { name: "description", content: "Seus favoritos, histórico de episódios e estatísticas no AniStream." },
      { property: "og:title", content: "Meu perfil — AniStream" },
      { property: "og:description", content: "Favoritos, histórico e estatísticas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Perfil,
});

function Perfil() {
  const navigate = useNavigate();
  return <DecoyProfile onExit={() => navigate({ to: "/" })} />;
}
