const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Player = "gu" | "li" | "cpu1" | "cpu2" | "cpu3";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return Response.json({ error: "OPENAI_API_KEY não configurada no Supabase." }, { status: 503, headers: corsHeaders });
    }

    const body = await req.json();
    const { theme, word, impostor, clues } = body ?? {};

    if (typeof theme !== "string" || typeof word !== "string" || typeof impostor !== "string" || !clues) {
      return Response.json({ error: "Dados da partida incompletos." }, { status: 400, headers: corsHeaders });
    }

    const players: Player[] = ["gu", "li", "cpu1", "cpu2", "cpu3"];
    const compactClues = Object.fromEntries(
      players.map((player) => [player, Array.isArray(clues[player]) ? clues[player].slice(0, 3) : []]),
    );

    const system = [
      "Você é o árbitro de um jogo social chamado Impostor.",
      "Existe exatamente um impostor. Os inocentes receberam a palavra secreta; o impostor recebeu apenas uma dica.",
      "Analise as três pistas de cada jogador em conjunto.",
      "Para cada CPU, escolha em quem ela deve votar entre os outros quatro jogadores.",
      "A decisão deve usar coerência semântica com a palavra secreta, consistência entre rodadas, especificidade das pistas e sinais de alguém tentando descobrir a palavra sem conhecê-la.",
      "Não escolha automaticamente o jogador com a pista mais curta. Uma pista curta pode ser boa se for específica.",
      "Os votos dos três CPUs podem ser diferentes.",
      "Não revele a palavra secreta nem o papel do impostor no texto de análise.",
      "Responda SOMENTE com JSON válido no formato: {"votes":{"cpu1":"gu|li|cpu1|cpu2|cpu3","cpu2":"gu|li|cpu1|cpu2|cpu3","cpu3":"gu|li|cpu1|cpu2|cpu3"},"analysis":{"gu":0,"li":0,"cpu1":0,"cpu2":0,"cpu3":0}}.",
      "A pontuação de analysis deve ser de 0 a 100 e representa apenas quão suspeito cada jogador parece.",
    ].join(" ");

    const user = JSON.stringify({
      theme,
      secret_word: word,
      actual_impostor: impostor,
      clues: compactClues,
    });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-6-luna",
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_output_tokens: 500,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return Response.json({ error: `Falha na análise da IA: ${detail.slice(0, 300)}` }, { status: 502, headers: corsHeaders });
    }

    const data = await response.json();
    const text = data.output_text ?? data.output?.flatMap((item: any) => item.content ?? []).map((part: any) => part.text ?? "").join("") ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("A IA não retornou JSON válido.");

    const parsed = JSON.parse(match[0]);
    const validPlayers = new Set(players);
    const votes = Object.fromEntries(
      (["cpu1", "cpu2", "cpu3"] as Player[]).map((cpu) => {
        const target = parsed?.votes?.[cpu];
        return [cpu, validPlayers.has(target) && target !== cpu ? target : null];
      }),
    );

    const analysis = Object.fromEntries(
      players.map((player) => [player, Math.max(0, Math.min(100, Number(parsed?.analysis?.[player]) || 0))]),
    );

    if (Object.values(votes).some((vote) => !vote)) {
      throw new Error("A IA não retornou votos válidos para todas as CPUs.");
    }

    return Response.json({ votes, analysis }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro inesperado na análise." },
      { status: 500, headers: corsHeaders },
    );
  }
});
