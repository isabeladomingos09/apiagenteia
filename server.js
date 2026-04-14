require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json());
app.use(cors());

// LOG DE DIAGNÓSTICO 1: Verificar se a chave foi lida do .env
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ ERRO CRÍTICO: Chave GEMINI_API_KEY não encontrada no arquivo .env!");
} else {
    console.log("✅ Chave de API carregada (Inicia com: " + apiKey.substring(0, 5) + "...)");
}

const genAI = new GoogleGenerativeAI(apiKey);

app.get('/api/status', (req, res) => {
    res.json({ status: "Online" });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { pergunta } = req.body;
        if (!pergunta) return res.status(400).json({ erro: "Envie uma pergunta." });

        console.log(`📩 Pergunta: ${pergunta}`);

        // LOG DE DIAGNÓSTICO 2: Testando o modelo mais básico e estável
// Use exatamente este nome: gemini-1.5-flash
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });    
    const promptFinal = `Você é um robô sarcástico. Responda: ${pergunta}`;
        
        const result = await model.generateContent(promptFinal);
        const response = await result.response;
        const text = response.text();

        return res.status(200).json({ resposta: text });

    } catch (erro) {
        // LOG DE DIAGNÓSTICO 3: Mostrar o erro real no terminal
        console.error("--- DETALHES DO ERRO ---");
        console.error("Mensagem:", erro.message);
        if (erro.response) {
            console.error("Dados do Erro Google:", erro.response);
        }
        console.error("------------------------");
        
        return res.status(500).json({ 
            erro: "Erro na API do Google", 
            detalhe: erro.message 
        });
    }
});

const PORTA = 3000;
app.listen(PORTA, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORTA}`);
});
