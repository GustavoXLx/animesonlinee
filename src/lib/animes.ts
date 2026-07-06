export type Anime = {
  id: number;
  title: string;
  genre: string;
  episodes: number;
  rating: number;
  year: number;
  gradient: string;
  emoji: string;
};

export const animes: Anime[] = [
  { id: 1, title: "Shadow Blade Chronicles", genre: "Ação", episodes: 24, rating: 8.7, year: 2023, gradient: "from-rose-500 to-orange-500", emoji: "⚔️" },
  { id: 2, title: "Kokoro no Melody", genre: "Romance", episodes: 12, rating: 9.1, year: 2024, gradient: "from-pink-400 to-fuchsia-600", emoji: "💗" },
  { id: 3, title: "Cyber Samurai X", genre: "Sci-Fi", episodes: 26, rating: 8.4, year: 2022, gradient: "from-cyan-500 to-blue-700", emoji: "🤖" },
  { id: 4, title: "Yokai Academy", genre: "Sobrenatural", episodes: 13, rating: 7.9, year: 2024, gradient: "from-violet-600 to-indigo-900", emoji: "👻" },
  { id: 5, title: "Chef no Kiseki", genre: "Slice of Life", episodes: 10, rating: 8.2, year: 2023, gradient: "from-amber-400 to-red-500", emoji: "🍜" },
  { id: 6, title: "Dragon Heart Saga", genre: "Fantasia", episodes: 50, rating: 9.3, year: 2021, gradient: "from-emerald-500 to-teal-800", emoji: "🐉" },
  { id: 7, title: "Neon Genesis Riot", genre: "Mecha", episodes: 26, rating: 9.0, year: 2020, gradient: "from-slate-700 to-purple-900", emoji: "🛸" },
  { id: 8, title: "Sakura Days", genre: "Romance", episodes: 12, rating: 8.5, year: 2024, gradient: "from-pink-300 to-rose-500", emoji: "🌸" },
  { id: 9, title: "Bakemono no Ken", genre: "Ação", episodes: 24, rating: 8.8, year: 2023, gradient: "from-red-700 to-gray-900", emoji: "🗡️" },
  { id: 10, title: "Ocean Sound", genre: "Drama", episodes: 11, rating: 8.6, year: 2024, gradient: "from-sky-400 to-blue-800", emoji: "🌊" },
  { id: 11, title: "Star Alchemist", genre: "Aventura", episodes: 22, rating: 8.9, year: 2022, gradient: "from-yellow-400 to-orange-600", emoji: "✨" },
  { id: 12, title: "Kage no Hunter", genre: "Ação", episodes: 25, rating: 9.2, year: 2023, gradient: "from-zinc-700 to-black", emoji: "🏹" },
  { id: 13, title: "Café Tokyo", genre: "Slice of Life", episodes: 12, rating: 8.0, year: 2024, gradient: "from-amber-600 to-yellow-800", emoji: "☕" },
  { id: 14, title: "Magical Girl Revolt", genre: "Mahou Shoujo", episodes: 13, rating: 8.3, year: 2023, gradient: "from-fuchsia-400 to-purple-700", emoji: "🌟" },
  { id: 15, title: "Iron Fist Legion", genre: "Ação", episodes: 24, rating: 8.5, year: 2022, gradient: "from-orange-600 to-red-900", emoji: "👊" },
  { id: 16, title: "Whispering Forest", genre: "Fantasia", episodes: 12, rating: 8.7, year: 2024, gradient: "from-green-600 to-emerald-900", emoji: "🌲" },
  { id: 17, title: "Galactic Idol", genre: "Musical", episodes: 12, rating: 8.1, year: 2024, gradient: "from-pink-500 to-indigo-600", emoji: "🎤" },
  { id: 18, title: "Shinobi Zero", genre: "Ação", episodes: 26, rating: 9.0, year: 2021, gradient: "from-neutral-800 to-red-950", emoji: "🥷" },
];
