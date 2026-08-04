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
