require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json());
app.use(cors()); // Importante para o Front-end acessar o Back-end

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

app.get('/api/status', (req, res) => {
    res.json({ status: "Online", ambiente: "Nuvem" });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { pergunta } = req.body;
        if (!pergunta) return res.status(400).json({ erro: "Envie uma pergunta." });

        // MODELO CORRIGIDO: gemini-1.5-flash é o padrão estável e gratuito
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });    
        const promptFinal = `Você é um robô sarcástico. Responda: ${pergunta}`;
        
        const result = await model.generateContent(promptFinal);
        const response = await result.response;
        const text = response.text();

        return res.status(200).json({ resposta: text });

    } catch (erro) {
        console.error("Erro:", erro.message);
        return res.status(500).json({ erro: "Erro na API do Google", detalhe: erro.message });
    }
});

// AJUSTE DA PORTA: Render define a porta automaticamente
const PORTA = process.env.PORT || 3000; 
app.listen(PORTA, () => {
    console.log(`🚀 Servidor rodando na porta ${PORTA}`);
});