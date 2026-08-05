import img1 from "@/assets/anime/1.jpg";
import img2 from "@/assets/anime/2.jpg";
import img3 from "@/assets/anime/3.jpg";
import img4 from "@/assets/anime/4.jpg";
import img5 from "@/assets/anime/5.jpg";
import img6 from "@/assets/anime/6.jpg";
import img7 from "@/assets/anime/7.jpg";
import img8 from "@/assets/anime/8.jpg";
import img9 from "@/assets/anime/9.jpg";
import img10 from "@/assets/anime/10.jpg";
import img11 from "@/assets/anime/11.jpg";
import img12 from "@/assets/anime/12.jpg";
import img13 from "@/assets/anime/13.jpg";
import img14 from "@/assets/anime/14.jpg";
import img15 from "@/assets/anime/15.jpg";
import img16 from "@/assets/anime/16.jpg";
import img17 from "@/assets/anime/17.jpg";
import img18 from "@/assets/anime/18.jpg";

export type Anime = {
  id: number;
  title: string;
  genre: string;
  episodes: number;
  rating: number;
  year: number;
  cover: string;
};

export const animes: Anime[] = [
  { id: 1, title: "Shadow Blade Chronicles", genre: "Ação", episodes: 24, rating: 8.7, year: 2023, cover: img1 },
  { id: 2, title: "Kokoro no Melody", genre: "Romance", episodes: 12, rating: 9.1, year: 2024, cover: img2 },
  { id: 3, title: "Cyber Samurai X", genre: "Sci-Fi", episodes: 26, rating: 8.4, year: 2022, cover: img3 },
  { id: 4, title: "Yokai Academy", genre: "Sobrenatural", episodes: 13, rating: 7.9, year: 2024, cover: img4 },
  { id: 5, title: "Chef no Kiseki", genre: "Slice of Life", episodes: 10, rating: 8.2, year: 2023, cover: img5 },
  { id: 6, title: "Dragon Heart Saga", genre: "Fantasia", episodes: 50, rating: 9.3, year: 2021, cover: img6 },
  { id: 7, title: "Neon Genesis Riot", genre: "Mecha", episodes: 26, rating: 9.0, year: 2020, cover: img7 },
  { id: 8, title: "Sakura Days", genre: "Romance", episodes: 12, rating: 8.5, year: 2024, cover: img8 },
  { id: 9, title: "Bakemono no Ken", genre: "Ação", episodes: 24, rating: 8.8, year: 2023, cover: img9 },
  { id: 10, title: "Ocean Sound", genre: "Drama", episodes: 11, rating: 8.6, year: 2024, cover: img10 },
  { id: 11, title: "Star Alchemist", genre: "Aventura", episodes: 22, rating: 8.9, year: 2022, cover: img11 },
  { id: 12, title: "Kage no Hunter", genre: "Ação", episodes: 25, rating: 9.2, year: 2023, cover: img12 },
  { id: 13, title: "Café Tokyo", genre: "Slice of Life", episodes: 12, rating: 8.0, year: 2024, cover: img13 },
  { id: 14, title: "Magical Girl Revolt", genre: "Mahou Shoujo", episodes: 13, rating: 8.3, year: 2023, cover: img14 },
  { id: 15, title: "Iron Fist Legion", genre: "Ação", episodes: 24, rating: 8.5, year: 2022, cover: img15 },
  { id: 16, title: "Whispering Forest", genre: "Fantasia", episodes: 12, rating: 8.7, year: 2024, cover: img16 },
  { id: 17, title: "Galactic Idol", genre: "Musical", episodes: 12, rating: 8.1, year: 2024, cover: img17 },
  { id: 18, title: "Shinobi Zero", genre: "Ação", episodes: 26, rating: 9.0, year: 2021, cover: img18 },
];

export const animes2: Anime[] = [
  { id: 19, title: "Ryuu no Kokoro", genre: "Fantasia", episodes: 24, rating: 8.6, year: 2025, cover: img6 },
  { id: 20, title: "Hoshi no Kakera", genre: "Drama", episodes: 12, rating: 8.8, year: 2025, cover: img10 },
  { id: 21, title: "Kurogane Squad", genre: "Ação", episodes: 26, rating: 8.4, year: 2025, cover: img15 },
  { id: 22, title: "Aoi Natsu", genre: "Romance", episodes: 12, rating: 9.0, year: 2025, cover: img8 },
  { id: 23, title: "Mecha Requiem", genre: "Mecha", episodes: 24, rating: 8.9, year: 2024, cover: img7 },
  { id: 24, title: "Yugure Detective", genre: "Mistério", episodes: 13, rating: 8.3, year: 2025, cover: img3 },
  { id: 25, title: "Tenkuu Pirates", genre: "Aventura", episodes: 36, rating: 8.7, year: 2023, cover: img11 },
  { id: 26, title: "Onmyou Records", genre: "Sobrenatural", episodes: 12, rating: 8.1, year: 2025, cover: img4 },
  { id: 27, title: "Ramen Kingdom", genre: "Slice of Life", episodes: 11, rating: 8.0, year: 2025, cover: img5 },
  { id: 28, title: "Idol Symphony", genre: "Musical", episodes: 12, rating: 8.2, year: 2024, cover: img17 },
  { id: 29, title: "Hanabi Promise", genre: "Romance", episodes: 10, rating: 9.2, year: 2025, cover: img2 },
  { id: 30, title: "Kamikaze Runner", genre: "Esporte", episodes: 25, rating: 8.5, year: 2024, cover: img12 },
  { id: 31, title: "Silent Forest Tale", genre: "Fantasia", episodes: 12, rating: 8.6, year: 2025, cover: img16 },
  { id: 32, title: "Neo Tokyo Beat", genre: "Sci-Fi", episodes: 22, rating: 8.9, year: 2025, cover: img1 },
  { id: 33, title: "Shinigami Bell", genre: "Sobrenatural", episodes: 24, rating: 9.1, year: 2024, cover: img9 },
  { id: 34, title: "Café no Yakusoku", genre: "Slice of Life", episodes: 12, rating: 8.4, year: 2025, cover: img13 },
  { id: 35, title: "Mahou Rebellion", genre: "Mahou Shoujo", episodes: 13, rating: 8.3, year: 2025, cover: img14 },
  { id: 36, title: "Zero Shinobi Legacy", genre: "Ação", episodes: 26, rating: 9.3, year: 2025, cover: img18 },
];

export const catalog: Anime[] = [...animes, ...animes2];

export const genres = Array.from(new Set(catalog.map((a) => a.genre)));

export const schedule: { day: string; items: Anime[] }[] = [
  { day: "Seg", items: [catalog[0], catalog[19]] },
  { day: "Ter", items: [catalog[5], catalog[27]] },
  { day: "Qua", items: [catalog[11], catalog[32]] },
  { day: "Qui", items: [catalog[7], catalog[21]] },
  { day: "Sex", items: [catalog[17], catalog[35]] },
  { day: "Sáb", items: [catalog[2], catalog[31]] },
  { day: "Dom", items: [catalog[9], catalog[19]] },
];

// ===== Detalhes editoriais (sinopse, estúdio, elenco) =====
export type AnimeDetail = {
  synopsis: string;
  studio: string;
  status: "Em exibição" | "Finalizado";
  age: "10+" | "12+" | "14+" | "16+";
  tags: string[];
  cast: string[];
};

const STUDIOS = ["Studio Hikari", "Kyoto Frame", "MAPPA Nova", "Bones Lab", "Ufotable JP", "Wit Aurora", "P.A. Yume", "Trigger Blue"];
const VOICES = [
  "Yuki Kaji", "Saori Hayami", "Kana Hanazawa", "Nobuhiko Okamoto", "Aoi Yuki", "Tomokazu Sugita",
  "Maaya Sakamoto", "Daisuke Ono", "Rie Takahashi", "Natsuki Hanae", "Ai Kayano", "Kenjiro Tsuda",
];

const SYNOPSIS: Record<number, string> = {
  1: "Após herdar uma lâmina que devora a própria sombra do portador, Rei aceita entrar na guilda dos caçadores noturnos para descobrir quem exterminou sua vila — e o preço de cada golpe é uma lembrança sua.",
  2: "Uma pianista que perdeu a audição e um garoto que só consegue cantar quando ninguém escuta se encontram no clube de música e decidem gravar uma canção antes que o ano acabe.",
  3: "Em Neo-Kyoto, samurais reconstruídos com peças de andróides protegem civis de corporações que vendem memórias. Kaito descobre que suas próprias memórias são um produto pirata.",
  4: "Na Academia Yokai, humanos e espíritos estudam juntos sob uma trégua frágil. Quando alunos começam a desaparecer nas noites de lua nova, uma caloura descobre que ela é o selo que mantém a escola de pé.",
  5: "Um cozinheiro tímido abre uma tasca minúscula que só serve um prato por noite. Cada cliente traz uma história, e cada história muda a receita do dia seguinte.",
  6: "Três reinos disputam o último ovo de dragão. Uma escudeira sem título jura protegê-lo, mesmo sabendo que a criatura vai crescer para queimar tudo o que ela ama.",
  7: "Pilotos adolescentes operam mechas alimentados por emoções. Quanto mais forte o sentimento, mais devastadora a arma — e mais rápido o piloto se apaga.",
  8: "Dois amigos de infância combinam se reencontrar embaixo da mesma cerejeira todo ano. No sétimo ano, só um aparece.",
  9: "Uma cidade portuária é assombrada por bestas que nascem de arrependimentos humanos. Um espadachim aposentado volta ao ofício para caçar a besta que tem o rosto do irmão dele.",
  10: "Depois de um verão que ninguém quer comentar, quatro amigos voltam à praia da infância para cumprir uma promessa gravada num gravador quebrado.",
  11: "Alquimistas mapeiam estrelas para transmutar metais. Uma aprendiz descobre uma constelação que não existe nos registros — e alguém está apagando quem olha para ela.",
  12: "Caçadores de sombras trabalham em duplas porque ninguém sobrevive sozinho. Quando o parceiro de Jin some dentro de uma fenda, ele decide entrar atrás.",
  13: "Um café escondido numa ruela de Tóquio atende quem está perdido na cidade. A dona anota os pedidos num caderno que sempre acerta o que a pessoa precisa.",
  14: "Garotas mágicas se sindicalizam contra a agência que as explora. A batalha final não é contra monstros, é contra o contrato que assinaram aos doze anos.",
  15: "Uma legião de lutadores de punho de ferro disputa o torneio subterrâneo da cidade. O prêmio é uma cirurgia que só um deles pode pagar.",
  16: "Uma floresta que sussurra o nome de quem entra. Uma menina muda aprende a responder e descobre que o bosque está pedindo socorro há séculos.",
  17: "Uma idol de terceira categoria recebe convite para cantar numa colônia orbital. O público são milhões de pessoas que nunca viram o céu da Terra.",
  18: "O último aluno de uma escola shinobi extinta aceita missões que ninguém quer para manter o nome do clã vivo. Cada missão o aproxima de quem queimou o dojo.",
  19: "Um coração de dragão bate dentro de um garoto humano. Enquanto o batimento acelera, o reino inteiro escuta — e se prepara para a caça.",
  20: "Fragmentos de estrelas caem no interior do país e curam qualquer ferida, menos a saudade. Uma enfermeira decide catalogar todos antes que virem mercadoria.",
  21: "Um esquadrão de reservistas recebe a missão mais suja da guerra. Sobreviver é o único jeito de provar que não eram descartáveis.",
  22: "Um verão azul, uma bicicleta emprestada e uma carta que nunca foi enviada. Duas pessoas têm até setembro para dizer o que sentem.",
  23: "Depois da última guerra, mechas viraram monumentos. Uma mecânica descobre que um deles ainda respira — e ainda tem ordens para cumprir.",
  24: "Um detetive que só trabalha no crepúsculo resolve casos que a polícia arquiva. O próximo arquivo tem o nome dele na capa.",
  25: "Piratas do céu roubam ilhas flutuantes inteiras. A nova tripulante tem um mapa tatuado nas costas e nenhuma lembrança de como chegou lá.",
  26: "Uma repartição pública registra espíritos como cidadãos. O funcionário mais novo precisa lidar com um fantasma que se recusa a aceitar que morreu.",
  27: "Uma família briga pelo caldo secreto do ramen do avô. O verdadeiro segredo é uma carta escondida no fundo da panela.",
  28: "Um grupo de idols precisa lotar um ginásio em trinta dias ou a agência fecha. Cada integrante esconde um motivo diferente para não desistir.",
  29: "Uma promessa feita embaixo dos fogos de artifício vira o único combustível de dois adolescentes separados por um oceano.",
  30: "Um velocista com problema no coração corre contra o cronômetro e contra o próprio médico. A final é no mesmo dia da cirurgia.",
  31: "Numa floresta onde o silêncio é lei, uma contadora de histórias é presa por falar alto. A punição é virar a próxima história.",
  32: "Neo Tóquio pulsa em batidas ilegais. Uma DJ constrói uma música capaz de derrubar o sistema de vigilância da cidade.",
  33: "Uma sineira do submundo toca para guiar almas. Quando o sino racha, os mortos começam a voltar pedindo justiça.",
  34: "Um café à beira do mar guarda promessas em envelopes lacrados. Toda primavera, alguém volta para abrir o seu.",
  35: "Garotas mágicas cansadas de salvar o mundo de graça montam uma cooperativa. O inimigo agora usa terno.",
  36: "O herdeiro do clã Zero recusa o título e cria uma escola aberta para qualquer criança. Os clãs antigos declaram guerra à ideia.",
};

export function animeDetail(a: Anime): AnimeDetail {
  return {
    synopsis:
      SYNOPSIS[a.id] ??
      `${a.title} acompanha personagens comuns colocados diante de escolhas grandes demais, num arco de ${a.episodes} episódios de ${a.genre.toLowerCase()}.`,
    studio: STUDIOS[a.id % STUDIOS.length],
    status: a.year >= 2025 ? "Em exibição" : "Finalizado",
    age: (["10+", "12+", "14+", "16+"] as const)[a.id % 4],
    tags: [a.genre, a.year >= 2025 ? "Simulcast" : "Clássico moderno", "Dub + Leg", a.rating >= 8.8 ? "Aclamado" : "Recomendado"],
    cast: [VOICES[a.id % VOICES.length], VOICES[(a.id + 4) % VOICES.length], VOICES[(a.id + 8) % VOICES.length]],
  };
}

export function getAnime(id: number): Anime | undefined {
  return catalog.find((a) => a.id === id);
}

export type Episode = { n: number; title: string; duration: string; date: string; filler: boolean };

const EP_TITLES = [
  "O primeiro passo", "Aquilo que ficou", "Chuva de verão", "Sem volta", "A promessa",
  "Cicatrizes", "O nome dela", "Silêncio antes", "Fogo cruzado", "Cartas antigas",
  "Noite mais longa", "Nem herói, nem vilão", "O segundo sino", "Última chance", "Amanhecer",
];

export function episodes(a: Anime): Episode[] {
  return Array.from({ length: Math.min(a.episodes, 24) }, (_, i) => ({
    n: i + 1,
    title: EP_TITLES[(a.id + i) % EP_TITLES.length],
    duration: `${22 + ((a.id + i) % 4)} min`,
    date: `${String(((i * 7) % 28) + 1).padStart(2, "0")}/${String(((a.id + i) % 12) + 1).padStart(2, "0")}`,
    filler: (a.id + i) % 9 === 0,
  }));
}

export function similar(a: Anime): Anime[] {
  return catalog.filter((x) => x.id !== a.id && x.genre === a.genre).slice(0, 6);
}
