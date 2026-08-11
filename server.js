require('dotenv').config({ path: 'config.env' });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require('multer');

const app = express();
app.use(express.json());
app.use(cors());

// --- 1. CONFIGURAÇÃO MULTER (Memória RAM) ---
// Recebe a imagem e guarda temporariamente na memória do servidor
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Limite de 10MB
});

// --- 2. CONEXÃO MONGODB ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Conectado!"))
    .catch(err => console.error("❌ Erro MongoDB:", err));

// --- 3. MODELOS ---
const Jogador = mongoose.model('Jogador', new mongoose.Schema({
    nome: { type: String, unique: true, required: true },
    xp: { type: Number, default: 0 }
}));

// --- 4. CONFIGURAÇÃO GEMINI ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- 5. ROTA DE VISÃO (DIRETO PARA O GEMINI) ---
app.post('/api/chat/vision', upload.single('imagem'), async (req, res) => {
    console.log("📸 Recebendo imagem para análise...");
    try {
        const { nickname, pergunta } = req.body;
        const arquivo = req.file;

        if (!arquivo) return res.status(400).json({ erro: "Envie uma imagem!" });

        // Transformamos o buffer da imagem em uma string Base64 que o Gemini entende
        const imagePart = {
            inlineData: {
                data: arquivo.buffer.toString("base64"),
                mimeType: arquivo.mimetype
            }
        };

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const promptIA = `Você é o Guardião do Conhecimento. O jogador ${nickname} enviou uma imagem. Analise-a e responda: ${pergunta}`;
        
        const result = await model.generateContent([promptIA, imagePart]);
        const respostaIA = result.response.text();

        console.log("✅ IA analisou a imagem com sucesso!");

        res.json({ 
            resposta: respostaIA,
            // Como não usamos Cloudinary, mandamos a própria imagem de volta em base64 para o front mostrar
            imageUrl: `data:${arquivo.mimetype};base64,${arquivo.buffer.toString("base64")}`
        });

    } catch (error) {
        console.error("Erro na visão:", error);
        res.status(500).json({ erro: "A IA não conseguiu ver a imagem." });
    }
});

// --- ROTA DE CHAT (TEXTO) ---
app.post('/api/chat', async (req, res) => {
    try {
        const { pergunta, nickname } = req.body;
        const modelTexto = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await modelTexto.generateContent(`Jogador ${nickname}: ${pergunta}`);
        res.json({ resposta: result.response.text() });
    } catch (error) {
        res.status(500).json({ erro: "Erro no chat." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor Multimodal Online em http://localhost:${PORT}`));