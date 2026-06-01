const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const os = require('os');
const path = require('path');
const OpenAI = require('openai');

dotenv.config();

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TRANSCRIPTION_FAIL_REPLY = "J’ai bien reçu votre vocal, mais je n’ai pas réussi à le transcrire. Pouvez-vous envoyer votre demande en texte ?";
const UNSUPPORTED_MEDIA_REPLY = "J’ai bien reçu votre fichier. Pour le moment, je traite surtout les messages texte et vocaux. Un conseiller peut vous aider si besoin.";
const OPENAI_SYSTEM_PROMPT = `Tu es l'assistant WhatsApp de AMI Voyages, une agence de voyages francophone basée en France. Tu aides les clients avec des questions simples sur billets d'avion, bagages, horaires, adresse, visa, paiement, documents, modifications et suivi. Réponds toujours en français, de manière professionnelle, concise, claire et rassurante. N'invente jamais une information inconnue. Si la demande nécessite vérification humaine ou un accès à des données non disponibles, dis qu'un conseiller AMI Voyages prendra le relais.`;

const INTENTS = [
    {
        name: 'horaire_vol',
        priority: 100,
        tests: [
            /\ba quelle heure est mon vol\b/i,
            /\bmon vol est a quelle heure\b/i,
            /\bmon vol est a quel heure\b/i,
            /\bheure de mon vol\b/i,
            /\bhoraire de mon vol\b/i,
            /\bhoraire vol\b/i,
            /\bheure vol\b/i,
            /\bc est quoi l heure de mon vol\b/i,
            /\bje veux l heure de mon vol\b/i,
            /\bje veux connaitre l heure de mon vol\b/i,
            /\bquel est l horaire de mon vol\b/i,
            /\bmon horaire de vol\b/i
        ],
        response: 'Merci d’indiquer votre référence de dossier et votre numéro de téléphone, et un conseiller prendra votre demande dès que possible.'
    },
    {
        name: 'modification_billet',
        priority: 95,
        tests: [
            /\bmodifier mon billet\b/i,
            /\bchanger mon billet\b/i,
            /\bmodifier mon vol\b/i,
            /\bchanger mon vol\b/i,
            /\bdecaler mon vol\b/i,
            /\breporter mon vol\b/i,
            /\bmodifier reservation\b/i,
            /\bchanger reservation\b/i
        ],
        response: 'Merci d’indiquer votre référence de dossier et votre numéro de téléphone, et un conseiller prendra votre demande dès que possible.'
    },
    {
        name: 'annulation_billet',
        priority: 95,
        tests: [
            /\bannuler mon billet\b/i,
            /\bannuler mon vol\b/i,
            /\bje veux annuler\b/i,
            /\bje souhaite annuler\b/i,
            /\bannulation billet\b/i,
            /\bannulation vol\b/i
        ],
        response: 'Merci d’indiquer votre référence de dossier et votre numéro de téléphone, et un conseiller prendra votre demande dès que possible.'
    },
    {
        name: 'remboursement',
        priority: 95,
        tests: [
            /\bremboursement\b/i,
            /\betre rembourse\b/i,
            /\brembourser mon billet\b/i,
            /\bje veux un remboursement\b/i,
            /\bje souhaite un remboursement\b/i,
            /\bcomment etre rembourse\b/i
        ],
        response: 'Merci d’indiquer votre référence de dossier et votre numéro de téléphone, et un conseiller prendra votre demande dès que possible.'
    },
    {
        name: 'bagages',
        priority: 90,
        tests: [
            /\bbagage\b/i,
            /\bbagages\b/i,
            /\bcombien de bagages\b/i,
            /\bj ai droit a combien de bagages\b/i,
            /\bpoids bagage\b/i,
            /\bfranchise bagage\b/i,
            /\bcombien de kilo(?:s)? de bagage\b/i
        ],
        response: 'Merci d’indiquer votre référence de dossier, votre compagnie aérienne et votre numéro de téléphone, et un conseiller vérifiera votre franchise bagages.'
    },
    {
        name: 'prix_billet',
        priority: 80,
        tests: [
            /\bprix billet\b/i,
            /\btarif billet\b/i,
            /\bcombien coute\b/i,
            /\bprix du vol\b/i,
            /\bdevis vol\b/i,
            /\bje veux un devis\b/i,
            /\bje veux connaitre le prix\b/i,
            /\bje veux connaitre le tarif\b/i,
            /\bcombien coute le billet\b/i,
            /\bje veux prendre un billet\b/i,
            /\bje veux acheter un billet\b/i
        ],
        response: 'Pour connaître le meilleur tarif, merci d’indiquer votre destination, votre ville de départ, vos dates, le nombre de passagers et votre numéro de téléphone.'
    },
    {
        name: 'destination',
        priority: 75,
        tests: [
            /\bje veux partir au bangladesh\b/i,
            /\bvols? jusqu au bangladesh\b/i,
            /\bvous faites les vols jusqu au bangladesh\b/i,
            /\bdestination bangladesh\b/i,
            /\bpartir au bangladesh\b/i,
            /\bvol pour le bangladesh\b/i,
            /\bbangladesh\b/i
        ],
        response: 'Oui, nous proposons des billets vers le Bangladesh. Merci de nous indiquer votre ville de départ, vos dates de voyage, le nombre de passagers et votre numéro de téléphone afin qu’un conseiller vous communique le meilleur tarif.'
    },
    {
        name: 'contact_conseiller',
        priority: 70,
        tests: [
            /\bparler a un conseiller\b/i,
            /\bparler a un agent\b/i,
            /\bservice client\b/i,
            /\bcontact humain\b/i,
            /\bje veux parler a quelqu un\b/i,
            /\bje veux parler a une personne\b/i,
            /\bje souhaite etre rappele\b/i
        ],
        response: 'Merci de nous indiquer votre demande ainsi que votre numéro de téléphone, et un conseiller vous répondra dès que possible.'
    },
    {
        name: 'horaires_agence',
        priority: 30,
        tests: [
            /\bquels sont vos horaires\b/i,
            /\bquels sont les horaires\b/i,
            /\bc est quand vos horaires\b/i,
            /\bcest quand vos horaires\b/i,
            /\bhoraires agence\b/i,
            /\bhoraire agence\b/i,
            /\bheure ouverture\b/i,
            /\bheures d ouverture\b/i,
            /\bquand ouvrez vous\b/i,
            /\bvous ouvrez quand\b/i,
            /\bhoraire d ouverture\b/i,
            /\badresse et horaires\b/i,
            /\bquelle est votre adresse\b/i,
            /\bou se trouve l agence\b/i,
            /\bou est votre agence\b/i
        ],
        response: 'Bonjour, nos horaires sont les suivants :\nAMI Voyages Paris Gare du Nord, 157 rue Lafayette, 75010 Paris : du lundi au samedi de 10h00 à 18h30.\nAMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République, 93300 Aubervilliers : du mardi au vendredi de 10h00 à 18h30.\nVous pouvez aussi nous écrire ici sur WhatsApp.'
    }
].sort((a, b) => b.priority - a.priority);

function normalizeText(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function detectIntent(message = '') {
    const normalizedMessage = normalizeText(message);
    console.log('[INTENT] normalized:', normalizedMessage);

    for (const intent of INTENTS) {
        if (intent.tests.some((regex) => regex.test(normalizedMessage))) {
            return intent;
        }
    }
    return null;
}

async function generateTravelReply(messageText) {
    const safeText = String(messageText || '').trim();
    if (!safeText) {
        return "Je peux vous aider pour les demandes simples. Pour cette demande, un conseiller AMI Voyages va vous répondre.";
    }

    const intent = detectIntent(safeText);
    if (intent) {
        console.log(`[INTENT] matched: ${intent.name}`);
        return intent.response;
    }

    console.log('[INTENT] fallback: openai');

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: OPENAI_SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `Message client : "${safeText}"\nRéponds en français de manière professionnelle, concise, claire et utile. Ne fais pas de listes, ne mets pas de markdown, et si la question nécessite un conseiller, réponds : "Je peux vous aider pour les demandes simples. Pour cette demande, un conseiller AMI Voyages va vous répondre."`
                }
            ],
            max_tokens: 220,
            temperature: 0.2
        });

        const rawResponse = completion?.choices?.[0]?.message?.content || '';
        const reply = sanitizeReply(rawResponse);
        if (!reply) {
            throw new Error('Réponse OpenAI vide');
        }

        return reply;
    } catch (error) {
        console.error('[OPENAI] Erreur génération:', error.response?.data || error.message || error);
        return getLocalTravelReply(messageText);
    }
}

function sanitizeReply(text) {
    return String(text || '')
        .replace(/\r?\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 700);
}

function getLocalTravelReply(messageText) {
    return "Bonjour, bienvenue chez AMI Voyages. Merci de préciser votre demande. Un conseiller peut aussi prendre le relais si nécessaire.";
}

async function handleTextMessage(text) {
    console.log('[TEXT] Contenu:', text);
    const safeText = String(text || '').trim();
    if (!safeText) {
        return "Je peux vous aider pour les demandes simples. Pour cette demande, un conseiller AMI Voyages va vous répondre.";
    }
    return await generateTravelReply(safeText);
}

async function handleAudioMessage(message) {
    const mediaId = message.audio?.id;
    if (!mediaId) {
        console.log('[AUDIO] media_id absent');
        return TRANSCRIPTION_FAIL_REPLY;
    }
    try {
        const mediaUrl = await getWhatsAppMediaUrl(mediaId);
        const tempFile = await downloadWhatsAppMedia(mediaUrl);
        const transcription = await transcribeAudio(tempFile);
        await deleteFile(tempFile);
        if (!transcription) {
            return TRANSCRIPTION_FAIL_REPLY;
        }
        console.log('[AUDIO] Transcription:', transcription);
        return await generateTravelReply(transcription);
    } catch (error) {
        console.error('[AUDIO] Erreur traitement vocal:', error.response?.data || error.message || error);
        return TRANSCRIPTION_FAIL_REPLY;
    }
}

async function getWhatsAppMediaUrl(mediaId) {
    const url = `https://graph.facebook.com/v17.0/${mediaId}?fields=url`;
    const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }
    });
    const mediaUrl = response.data?.url;
    if (!mediaUrl) {
        throw new Error('Impossible de récupérer l’URL du média WhatsApp');
    }
    return mediaUrl;
}

async function downloadWhatsAppMedia(mediaUrl) {
    const tempFilePath = path.join(os.tmpdir(), `whatsapp-audio-${Date.now()}-${Math.random().toString(16).slice(2)}.ogg`);
    const response = await axios.get(mediaUrl, {
        responseType: 'stream',
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }
    });
    await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(tempFilePath);
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
    console.log('[AUDIO] Fichier téléchargé:', tempFilePath);
    return tempFilePath;
}

async function transcribeAudio(filePath) {
    try {
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: 'whisper-1'
        });
        return transcription?.text?.trim() || null;
    } catch (error) {
        console.error('[OPENAI] Erreur transcription:', error.response?.data || error.message || error);
        return null;
    }
}

async function deleteFile(filePath) {
    try {
        await fs.promises.unlink(filePath);
        console.log('[AUDIO] Fichier temporaire supprimé:', filePath);
    } catch (error) {
        console.warn('[AUDIO] Échec suppression fichier temporaire:', error.message || error);
    }
}

async function sendWhatsAppText(to, body) {
    const url = `https://graph.facebook.com/v17.0/${process.env.PHONE_NUMBER_ID}/messages`;
    const text = sanitizeReply(body);
    try {
        const payload = {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { preview_url: false, body: text }
        };
        const response = await axios.post(url, payload, {
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('[WHATSAPP] Message envoyé, id:', response.data.messages?.[0]?.id || 'aucun id');
    } catch (error) {
        console.error('[WHATSAPP] Erreur envoi message:', error.response?.data || error.message || error);
        throw error;
    }
}

app.get('/', (req, res) => {
    res.send('AMI Voyages chatbot is running');
});

app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('[WEBHOOK] Query reçue:', req.query);
    console.log('[WEBHOOK] ENV check:', {
        expectedToken: process.env.WEBHOOK_VERIFY_TOKEN,
        receivedToken: token,
        challenge,
        mode
    });

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
        return res.status(200).send(String(challenge));
    }
    return res.status(403).send('Webhook verification failed');
});

app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        if (
            body.object !== 'whatsapp_business_account' ||
            !body.entry ||
            !body.entry[0] ||
            !body.entry[0].changes ||
            !body.entry[0].changes[0] ||
            !body.entry[0].changes[0].value
        ) {
            console.log('[WEBHOOK] Événement ignoré : format non WhatsApp');
            return res.status(200).send('Ignore non-WhatsApp event');
        }
        const value = body.entry[0].changes[0].value;
        const messages = Array.isArray(value.messages) ? value.messages : null;
        const message = messages && messages.length ? messages[0] : null;
        if (!message) {
            console.log('[WEBHOOK] Aucun message à traiter');
            return res.status(200).send('No message to process');
        }
        const sender = message.from;
        const messageType = message.type;
        console.log('[WEBHOOK] Message reçu de', sender, 'type=', messageType);
        let replyText;
        if (messageType === 'text') {
            const textBody = message.text?.body || '';
            replyText = await handleTextMessage(textBody);
        } else if (messageType === 'audio') {
            replyText = await handleAudioMessage(message);
        } else {
            console.log('[WEBHOOK] Type non géré:', messageType);
            replyText = UNSUPPORTED_MEDIA_REPLY;
        }
        console.log('[WEBHOOK] Réponse finale:', replyText);
        await sendWhatsAppText(sender, replyText);
        return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
        console.error('[WEBHOOK] Erreur traitement message:', error.response?.data || error.message || error);
        return res.status(500).send('Erreur serveur');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
