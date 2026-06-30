require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json());
app.use(cors());

// --- CONFIGURAÇÕES E VALIDAÇÃO DE CHAVES ---
const apiKey = process.env.GEMINI_API_KEY;
const weatherKey = process.env.WEATHER_API_KEY;

if (!apiKey) console.error("❌ ALERTA: GEMINI_API_KEY não definida!");
if (!weatherKey) console.error("❌ ALERTA: WEATHER_API_KEY não definida!");

const genAI = new GoogleGenerativeAI(apiKey);

// --- FASE 1: FERRAMENTAS (FUNÇÕES LOCAIS) ---

// 1. Função de Clima (OpenWeather)
async function buscarClimaTempoReal(args) {
    const cidade = args.cidade;
    console.log(`[Agente] Executando buscarClimaTempoReal para: ${cidade}`);
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${cidade}&units=metric&lang=pt_br&appid=${weatherKey}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.cod !== 200) {
            return { erro: `Cidade '${cidade}' não encontrada.` };
        }

        return {
            cidade: data.name,
            temperatura: `${data.main.temp}°C`,
            clima: data.weather[0].description,
            umidade: `${data.main.humidity}%`
        };
    } catch (error) {
        return { erro: "Erro ao conectar na API de clima." };
    }
}

// 2. Função de Moeda (AwesomeAPI - Não precisa de chave)
async function converterMoeda(args) {
    const { de, para, valor } = args;
    console.log(`[Agente] Executando converterMoeda: ${valor} ${de} para ${para}`);
    const url = `https://economia.awesomeapi.com.br/last/${de}-${para}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        const par = `${de}${para}`;
        
        if (!data[par]) return { erro: "Par de moedas não suportado ou inválido." };

        const cotacao = parseFloat(data[par].bid);
        const resultado = (cotacao * valor).toFixed(2);

        return {
            moedaOrigem: de,
            moedaDestino: para,
            valorOriginal: valor,
            valorConvertido: resultado,
            taxa: cotacao
        };
    } catch (error) {
        return { erro: "Erro ao conectar na API de moedas." };
    }
}

// Mapeamento para facilitar a chamada dinâmica
const funcoesDisponiveis = {
    buscarClimaTempoReal,
    converterMoeda
};

// --- FASE 2: DECLARAÇÃO DAS FERRAMENTAS (JSON SCHEMA) ---

const declaracaoClima = {
    name: "buscarClimaTempoReal",
    description: "Obtém a temperatura e o clima atual de uma cidade. Use sempre que o usuário perguntar sobre o tempo ou temperatura.",
    parameters: {
        type: "OBJECT",
        properties: {
            cidade: { type: "STRING", description: "O nome da cidade. Ex: Curitiba, Tokyo, London." }
        },
        required: ["cidade"]
    }
};

const declaracaoMoeda = {
    name: "converterMoeda",
    description: "Converte valores entre moedas como Real (BRL), Dólar (USD) e Euro (EUR).",
    parameters: {
        type: "OBJECT",
        properties: {
            de: { type: "STRING", description: "Moeda de origem (código ISO). Ex: BRL, USD, EUR." },
            para: { type: "STRING", description: "Moeda de destino (código ISO). Ex: BRL, USD, EUR." },
            valor: { type: "NUMBER", description: "O valor numérico a ser convertido." }
        },
        required: ["de", "para", "valor"]
    }
};

// --- FASE 3: CONFIGURAÇÃO DO MODELO ---
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    tools: [{ functionDeclarations: [declaracaoClima, declaracaoMoeda] }] 
});

// --- FASE 4: ROTA PRINCIPAL COM LOOP DE AGENTE ---

app.post('/api/chat', async (req, res) => {
    try {
        const { pergunta } = req.body;
        if (!pergunta) return res.status(400).json({ erro: "Envie uma pergunta." });

        console.log("-> Pergunta do usuário:", pergunta);

        // Inicia o chat
        const chat = model.startChat();
        let result = await chat.sendMessage(pergunta);
        let response = result.response;

        // VERIFICAÇÃO DE CHAMADA DE FUNÇÃO
        // O Gemini pode decidir chamar uma função. Verificamos nos "parts" da resposta.
        const part = response.candidates[0].content.parts.find(p => p.functionCall);

        if (part) {
            const { name, args } = part.functionCall;
            console.log(`[IA] Solicitou função: ${name}`);

            // Executa a função localmente
            if (funcoesDisponiveis[name]) {
                const resultadoDaFerramenta = await funcoesDisponiveis[name](args);
                console.log("[Sistema] Resultado da ferramenta:", resultadoDaFerramenta);

                // Envia o resultado de volta para a IA formular o texto final
                result = await chat.sendMessage([{
                    functionResponse: {
                        name: name,
                        response: { content: resultadoDaFerramenta }
                    }
                }]);

                response = result.response;
            }
        }

        // Resposta textual final para o usuário
        const textoFinal = response.text();
        return res.status(200).json({ resposta: textoFinal });

    } catch (error) {
        // Log detalhado do erro no console do Render
        console.error("--- ERRO CRÍTICO NO BACKEND ---");
        console.error("Mensagem:", error.message);
        console.error("Stack:", error.stack);

        return res.status(500).json({ 
            erro: "Erro interno no servidor.",
            detalhes: error.message 
        });
    }
});

// Rota de teste para verificar se o servidor está online
app.get('/', (req, res) => res.send("🚀 API Agente IA Online!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
});