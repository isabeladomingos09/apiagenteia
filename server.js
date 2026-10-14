require('dotenv').config({ path: 'config.env' });
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const multer = require('multer');
const { gerarComRetry } = require('./gemini');

const app = express();
app.use(express.json());
app.use(cors());

// Socket.io "abraça" o Express: precisamos de um servidor HTTP em volta dele
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- 1. CONFIGURAÇÃO MULTER (Memória RAM) ---
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

// --- 2. CONEXÃO MONGODB ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Conectado!"))
    .catch(err => console.error("❌ Erro MongoDB:", err));

// --- 3. ROTAS DE AUTENTICAÇÃO E DOCUMENTO ---
const authRoutes = require('./routes/authRoutes');
const documentRoutes = require('./routes/documentRoutes');

app.use('/api', authRoutes);
app.use('/api', documentRoutes);

// --- 4. HEALTH CHECK (PÚBLICA) ---
app.get('/api/health', async (req, res) => {
    try {
        const dbConectado = mongoose.connection.readyState === 1;
        if (dbConectado) {
            return res.status(200).json({
                status: "ok",
                bancoDeDados: "conectado",
                timestamp: new Date().toISOString()
            });
        }
        return res.status(503).json({
            status: "error",
            bancoDeDados: "desconectado",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            bancoDeDados: "erro na verificação",
            erro: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// --- 5. ROTA DE VISÃO ---
app.post('/api/chat/vision', upload.single('imagem'), async (req, res) => {
    console.log("📸 Recebendo imagem para análise...");
    try {
        const { nickname, pergunta } = req.body;
        const arquivo = req.file;

        if (!arquivo) return res.status(400).json({ erro: "Envie uma imagem!" });

        const imagePart = {
            inlineData: {
                data: arquivo.buffer.toString("base64"),
                mimeType: arquivo.mimetype
            }
        };

        const promptIA = `Você é o Guardião do Conhecimento. O jogador ${nickname} enviou uma imagem. Analise-a e responda: ${pergunta}`;
        const resposta = await gerarComRetry([promptIA, imagePart]);

        res.json({
            resposta,
            imageUrl: `data:${arquivo.mimetype};base64,${arquivo.buffer.toString("base64")}`
        });
    } catch (error) {
        console.error("Erro na visão:", error);
        res.status(500).json({ erro: "A IA não conseguiu ver a imagem." });
    }
});

// --- 6. ROTA DE CHAT (TEXTO) ---
app.post('/api/chat', async (req, res) => {
    try {
        const { pergunta, nickname } = req.body;
        const resposta = await gerarComRetry(`Jogador ${nickname}: ${pergunta}`);
        res.json({ resposta });
    } catch (error) {
        console.error("Erro no chat:", error);
        res.status(500).json({ erro: "Erro no chat." });
    }
});

// =====================================================
// --- 7. WEBSOCKET: SALA PÚBLICA + BOT MODERADOR ---
// =====================================================
const NOME_BOT = "🤖 Moderador Gemini";

// SEGURANÇA: recusa a conexão se o token JWT for inválido
io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error("Token não fornecido."));

    try {
        socket.usuario = jwt.verify(token, process.env.JWT_SECRET); // { id, nome }
        next();
    } catch (err) {
        next(new Error("Token inválido ou expirado."));
    }
});

io.on('connection', (socket) => {
    console.log(`🔌 ${socket.usuario.nome} conectou (${socket.id})`);

    // Desafio Hacker: contador de usuários online
    io.emit('usuariosOnline', io.sockets.sockets.size);

    socket.on('novaMensagem', async (dados) => {
        const texto = dados && typeof dados.texto === 'string' ? dados.texto.trim() : "";
        if (!texto || texto.length > 500) return;

        // Broadcast: espalha a mensagem para TODOS da sala
        io.emit('mensagemRecebida', {
            nome: socket.usuario.nome,
            texto,
            bot: false,
            hora: new Date().toISOString()
        });

        // GATILHO: a IA só responde quando é chamada com @gemini
        if (/@gemini/i.test(texto)) {
            const pergunta = texto.replace(/@gemini/gi, '').trim() || "Olá!";
            try {
                const prompt = `Você é o "Moderador Gemini", um assistente simpático e objetivo em uma sala de chat pública. ${socket.usuario.nome} chamou você e disse: "${pergunta}". Responda de forma curta e útil.`;
                const respostaBot = await gerarComRetry(prompt);

                io.emit('mensagemRecebida', {
                    nome: NOME_BOT,
                    texto: respostaBot,
                    bot: true,
                    hora: new Date().toISOString()
                });
            } catch (error) {
                console.error("Erro do bot na sala:", error);
                io.emit('mensagemRecebida', {
                    nome: NOME_BOT,
                    texto: "Desculpe, não consegui responder agora.",
                    bot: true,
                    hora: new Date().toISOString()
                });
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`❌ ${socket.usuario.nome} desconectou`);
        io.emit('usuariosOnline', io.sockets.sockets.size);
    });
});

// ATENÇÃO: é server.listen (e não app.listen)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Servidor Online em http://localhost:${PORT}`));