
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const handleGeminiError = (error: any): never => {
  console.error("Detalhes do erro Gemini:", error);

  let userMessage = `Erro no Serviço de IA: ${error.message || "Indisponível"}`;

  if (error.message) {
    if (error.message.includes("API_KEY")) {
      userMessage = "Erro de configuração: Chave de API inválida.";
    } else if (error.message.includes("404")) {
      userMessage = "Modelo de IA não encontrado ou acesso não liberado (404).";
    } else if (error.message.includes("429")) {
      userMessage = "Limite de requisições excedido (Quota).";
    }
  }

  throw new Error(userMessage);
};

export const analyzeItinerary = async (data: { 
  itinerary: string; 
  vehicle: string; 
  startOdometer: number; 
  employeeName: string; 
  startTime: string;
}) => {
  try {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY_MISSING");
    }

    const { itinerary, vehicle, startOdometer, employeeName, startTime } = data;
    
    const prompt = `
      Atue como um Especialista em Logística e Eficiência de Frota da NBAPARK em Gramado/RS.
      
      DADOS DA VIAGEM:
      - Motorista: ${employeeName}
      - Veículo: ${vehicle}
      - KM Atual: ${startOdometer}
      - Horário Saída: ${new Date(startTime).toLocaleTimeString('pt-BR')}
      - Destino/Itinerário Informado: "${itinerary}"
      
      CONTEXTO GEOGRÁFICO:
      - Base: NBAPARK Gramado.
      - Ponto de Interesse Conhecido: "Loja Centro" fica no bairro centro na Pedras Altas, Gramado.
      
      SUA MISSÃO:
      1. ROTA & PREVISÃO: Analise o itinerário. Se o destino for vago (ex: "Centro"), sugira a melhor rota considerando a geografia de Gramado. Se for para a "Loja Centro", mencione explicitamente a ida para Pedras Altas.
      2. ECONOMIA & USO: Dê uma dica específica para o veículo (${vehicle}) para economizar combustível neste trajeto específico (ex: uso de marchas na serra, ar condicionado, etc).
      3. SEGURANÇA: Dê um palpite breve de segurança baseado no horário e local.
      
      RESPOSTA:
      Gere um texto curto, direto, motivador e profissional de no máximo 50 palavras, dirigido ao motorista. Use formatação simples.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        maxOutputTokens: 800,
        temperature: 0.7,
      },
    });
    
    if (!response.text) {
      throw new Error("Resposta vazia da IA");
    }

    return response.text;
  } catch (error) {
    handleGeminiError(error);
  }
};

export const generateWeeklySummary = async (trips: any[]) => {
  try {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY_MISSING");
    }

    // Filtrar apenas dados essenciais para reduzir tokens e focar a análise
    const relevantData = trips.map(t => ({
      motorista: t.employeeName,
      veiculo: t.vehicle || "Veículo Padrão",
      status: t.status,
      km_percorrido: t.endOdometer ? (t.endOdometer - t.startOdometer) : 0,
      rota: t.itinerary
    }));

    const tripsData = JSON.stringify(relevantData);
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Atue como o Gerente de Frota da NBAPARK. Com base nestes registros de veículos: ${tripsData}. Gere um insight executivo curto e direto (máximo 40 palavras) sobre a produtividade da frota hoje. Cite quem rodou mais, qual veículo foi mais usado e se há algo fora do comum. Use um tom profissional e motivador.`,
      config: {
        maxOutputTokens: 400,
        temperature: 0.6,
      }
    });

    if (!response.text) {
      throw new Error("Não foi possível gerar o texto do resumo.");
    }

    return response.text;
  } catch (error) {
    handleGeminiError(error);
  }
};
