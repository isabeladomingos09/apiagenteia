const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const verificarToken = require('../middlewares/authMiddleware');
const DocumentoSessao = require('../models/DocumentoSessao');
const { gerarComRetry } = require('../gemini');

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

function montarPromptRAG(textoExtraido, pergunta) {
    return `
Você é um analista de dados corporativo extremamente preciso.
Abaixo está um documento de referência. Responda à pergunta do usuário baseando-se APENAS no texto fornecido.
Se a resposta não estiver no texto, diga exatamente: "Desculpe, não encontrei essa informação no documento." NÃO INVENTE DADOS.

DOCUMENTO:
"""
${textoExtraido}
"""

PERGUNTA DO USUÁRIO: ${pergunta}
`;
}

async function extrairTexto(arquivo) {
    if (arquivo.mimetype === "application/pdf") {
        const dadosPDF = await pdfParse(arquivo.buffer);
        return dadosPDF.text;
    } else if (arquivo.mimetype === "text/plain") {
        return arquivo.buffer.toString("utf-8");
    }
    return null; // formato não suportado
}

// ROTA BASE: POST /api/chat/documento (upload + pergunta, sem salvar no banco)
router.post('/chat/documento', verificarToken, upload.single('documento'), async (req, res) => {
    try {
        const { pergunta } = req.body;
        const arquivo = req.file;

        if (!arquivo) return res.status(400).json({ erro: "Envie um arquivo PDF ou TXT!" });
        if (!pergunta) return res.status(400).json({ erro: "Digite uma pergunta!" });

        const textoExtraido = await extrairTexto(arquivo);
        if (textoExtraido === null) {
            return res.status(400).json({ erro: "Formato não suportado. Envie PDF ou TXT." });
        }
        if (!textoExtraido || textoExtraido.trim().length === 0) {
            return res.status(400).json({ erro: "Não consegui extrair texto deste arquivo." });
        }

        const resposta = await gerarComRetry(montarPromptRAG(textoExtraido, pergunta));
        res.json({ resposta });

    } catch (error) {
        console.error("Erro no chat com documento:", error);
        res.status(500).json({ erro: "Erro ao processar o documento." });
    }
});

// DESAFIO HACKER 1: POST /api/chat/documento/sessao (salva o texto no Mongo e devolve um sessaoId)
router.post('/chat/documento/sessao', verificarToken, upload.single('documento'), async (req, res) => {
    try {
        const { pergunta } = req.body;
        const arquivo = req.file;

        if (!arquivo) return res.status(400).json({ erro: "Envie um arquivo PDF ou TXT!" });
        if (!pergunta) return res.status(400).json({ erro: "Digite uma pergunta!" });

        const textoExtraido = await extrairTexto(arquivo);
        if (textoExtraido === null) {
            return res.status(400).json({ erro: "Formato não suportado. Envie PDF ou TXT." });
        }
        if (!textoExtraido || textoExtraido.trim().length === 0) {
            return res.status(400).json({ erro: "Não consegui extrair texto deste arquivo." });
        }

        const novaSessao = new DocumentoSessao({
            usuarioId: req.usuario.id,
            nomeArquivo: arquivo.originalname,
            textoExtraido
        });
        await novaSessao.save();

        const resposta = await gerarComRetry(montarPromptRAG(textoExtraido, pergunta));

        res.json({ resposta, sessaoId: novaSessao._id });

    } catch (error) {
        console.error("Erro ao criar sessão de documento:", error);
        res.status(500).json({ erro: "Erro ao processar o documento." });
    }
});

// DESAFIO HACKER 2: POST /api/chat/documento/continuar (usa o texto já salvo, sem reenviar o arquivo)
router.post('/chat/documento/continuar', verificarToken, async (req, res) => {
    try {
        const { pergunta, sessaoId } = req.body;

        if (!pergunta || !sessaoId) {
            return res.status(400).json({ erro: "Envie 'pergunta' e 'sessaoId'." });
        }

        const sessao = await DocumentoSessao.findById(sessaoId);
        if (!sessao) {
            return res.status(404).json({ erro: "Sessão de documento não encontrada." });
        }

        // Só o dono da sessão pode continuar usando ela
        if (sessao.usuarioId.toString() !== req.usuario.id) {
            return res.status(403).json({ erro: "Você não tem acesso a essa sessão." });
        }

        const resposta = await gerarComRetry(montarPromptRAG(sessao.textoExtraido, pergunta));
        res.json({ resposta });

    } catch (error) {
        console.error("Erro ao continuar sessão de documento:", error);
        res.status(500).json({ erro: "Erro ao processar a pergunta." });
    }
});

module.exports = router;