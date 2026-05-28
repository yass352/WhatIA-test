const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('AMI Voyages chatbot is running');
});

app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('[WEBHOOK] Vérification', { mode, token, challenge });

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }

    return res.status(403).send('Webhook verification failed');
});

app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        console.log('[WEBHOOK] Reçu:', JSON.stringify(body, null, 2));

        // Vérification format WhatsApp Cloud API
        if (
            body.object !== 'whatsapp_business_account' ||
            !body.entry ||
            !body.entry[0] ||
            !body.entry[0].changes ||
            !body.entry[0].changes[0] ||
            !body.entry[0].changes[0].value
        ) {
            return res.status(200).send('Ignore non-WhatsApp event');
        }

        const value = body.entry[0].changes[0].value;
        const messages = Array.isArray(value.messages) ? value.messages : null;
        const message = messages && messages.length ? messages[0] : null;

        if (!message || message.type !== 'text') {
            console.log('[WEBHOOK] Message non texte ou absent, ignore.');
            return res.status(200).send('No text message to process');
        }

        const phoneNumber = message.from; // numéro expéditeur
        const messageText = message.text?.body || '';

        const replyText = getBotReply(messageText);

        console.log('[WEBHOOK] Message de', phoneNumber, 'Texte:', messageText);
        console.log('[WEBHOOK] Réponse:', replyText);

        await sendWhatsAppMessage(phoneNumber, replyText);

        return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
        console.error('[WEBHOOK] Erreur traitement message:', error);
        return res.status(500).send('Erreur serveur');
    }
});

// Normalise le texte pour une meilleure détection
function normalizeText(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
        .replace(/[^\w\s]/g, ' ') // Remplacer la ponctuation par des espaces
        .replace(/\s+/g, ' ') // Nettoyer les espaces multiples
        .trim();
}

// Réponses métier centralisées (AMI Voyages)
const responses = {
    horaires: "Bonjour, nos horaires sont les suivants :\nAMI Voyages Paris Gare du Nord, 157 rue Lafayette, 75010 Paris : du lundi au samedi de 10h00 à 18h30.\nAMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République, 93300 Aubervilliers : du mardi au vendredi de 10h00 à 18h30.\nVous pouvez aussi nous écrire ici sur WhatsApp.",
    disponibilite_prix: "Les prix varient selon la destination, la date, la compagnie aérienne et les places disponibles.\nMerci de nous indiquer :\n- votre destination,\n- votre ville de départ et votre ville de retour,\n- vos dates de départ et de retour,\n- le nombre de passagers,\n- votre préférence éventuelle : compagnie aérienne, vol direct ou prix le plus bas.",
    visa: "Oui, nous proposons une assistance visa pour certaines destinations uniquement.\nIndiquez-nous votre destination et votre nationalité afin de vérifier si nous pouvons vous aider.",
    paiement: "Nous acceptons les virements bancaires, les espèces, les chèques, ainsi que les chèques-vacances / Connect.\nNous pouvons aussi vous envoyer un lien de paiement en ligne.\nSelon le dossier, un paiement en plusieurs fois peut être possible, sous condition.",
    annulation_modification: "Les conditions d'annulation ou de modification dépendent du billet réservé, de la compagnie aérienne et des règles tarifaires.\nSi vous avez déjà un dossier, envoyez-nous votre référence ou votre numéro, et un conseiller vérifiera cela.",
    bagage: "Le nombre de kilos et de bagages autorisés dépend de la compagnie aérienne, de la destination et du billet réservé.\nSi vous avez déjà une réservation, envoyez-nous votre référence pour vérification.",
    bagage_extra: "Cela dépend du billet que vous avez acheté.\nVous pouvez généralement ajouter des bagages en supplément, selon les conditions de la compagnie aérienne.",
    siege: "Le choix du siège dépend de la compagnie aérienne et du type de billet.\nSur certains vols, il est possible de choisir un siège, parfois avec des frais supplémentaires.",
    bus: "Non, nous proposons uniquement des voyages aériens.\nNotre agence est spécialisée dans les destinations d'Asie du Sud, comme le Bangladesh, l'Inde et le Sri Lanka, ainsi que d'Afrique subsaharienne, comme le Mali, le Sénégal, la Guinée ou la RDC.",
    telephone: "Nous faisons de notre mieux pour répondre à tous les appels.\nSi nos lignes sont occupées, vous pouvez nous écrire ici sur WhatsApp et nous traiterons votre demande dès que possible.",
    rappel: "Oui, nous pouvons transmettre votre demande à un conseiller.\nMerci d'indiquer votre nom et le sujet de votre demande.",
    adresse: "Bonjour, voici nos agences :\nAMI Voyages Paris Gare du Nord, 157 rue Lafayette, 75010 Paris.\nAMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République, 93300 Aubervilliers.",
    destination: "Nous travaillons principalement sur les destinations d'Asie du Sud et d'Afrique subsaharienne.\nIndiquez-nous la destination souhaitée et nous vous confirmerons si nous pouvons vous proposer une solution.",
    documents: "Les documents nécessaires dépendent de la destination, de votre nationalité et du type de voyage.\nIndiquez-nous votre destination et votre nationalité afin que nous puissions vous orienter.",
    omra_hajj: "Oui, nous pouvons vous accompagner pour les voyages omra et hajj selon la période et les disponibilités.\nIndiquez-nous le nombre de voyageurs, la période souhaitée et votre ville de départ afin qu'un conseiller puisse vous orienter.",
    devis: "Oui, nous pouvons transmettre votre demande à un conseiller.\nMerci d'indiquer :\n- votre destination,\n- votre ville de départ et votre ville de retour,\n- vos dates,\n- le nombre de passagers,\n- votre numéro de téléphone.",
    delai: "Nous faisons de notre mieux pour répondre dans les meilleurs délais pendant les horaires d'ouverture.\nEn dehors de ces horaires, vous pouvez déjà nous laisser votre demande ici sur WhatsApp.",
    paiement_distance: "Selon le dossier, un paiement à distance est possible par carte bancaire via un lien de paiement sécurisé.\nMerci de nous préciser votre demande afin qu'un conseiller puisse vous informer sur les modalités disponibles.",
    lien_paiement: "Merci de nous indiquer votre facture d'achat, ou à défaut la copie du passeport du passager.",
    dossier: "Oui, un conseiller peut vérifier votre dossier.\nMerci d'indiquer votre référence de dossier ainsi que votre nom.",
    billet_modifier: "Oui, cela doit être vérifié par un conseiller.\nMerci d'indiquer votre référence de dossier ainsi que votre demande de modification.",
    vol_annule_retarde: "Nous sommes désolés pour la gêne occasionnée.\nMerci d'indiquer votre référence de dossier et votre numéro de téléphone, et un conseiller prendra votre demande dès que possible.",
    statut_vol: "Merci de nous envoyer la référence de votre billet, le numéro de billet, la référence de votre facture ou la copie du passeport du passager, s'il vous plaît.\nSinon vous pouvez aussi vérifier directement sur le site de la compagnie aérienne concernée avec votre référence de billet.",
    femme_enceinte: "Les femmes enceintes peuvent voyager en général jusqu'à 6 mois.\nAu-delà, il faut une autorisation médicale, sous réserve d'acceptation de la compagnie aérienne et des services aéroportuaires.",
    bebe_billet: "De 1 jour à moins de 2 ans, le passager est considéré dans la catégorie bébé.\nIl paie généralement les taxes aéroport, selon les conditions du billet.\nÀ partir de 2 ans jusqu'à moins de 12 ans, il est considéré comme enfant.\nÀ partir de 12 ans, il est considéré comme adulte.",
    bebe_bagage: "Oui, en général, les bébés ont droit à des bagages.\nCela dépend de la compagnie aérienne.\nSauf chez Saudia Airlines, où c'est 23 kilos.",
    prix_moins_cher: "En général, les tarifs sont plus avantageux hors vacances scolaires et hors week-end.",
    bagage_enfant: "Les bagages pour les enfants suivent généralement les mêmes normes que pour les adultes.",
    duree_min: "En Asie, c'est généralement 5 à 7 jours.\nEn Afrique, c'est généralement 3 jours, selon la compagnie aérienne.",
    agent_disponible: "Tous nos agents sont disponibles selon leur planning.",
    salutation: "Bonjour, en quoi puis-je vous aider ?\nSi vous souhaitez connaître les tarifs, merci de nous indiquer :\n- votre destination,\n- votre ville de départ et votre ville de retour,\n- vos dates de départ et de retour,\n- le nombre de passagers,\n- votre préférence éventuelle : compagnie aérienne, vol direct ou prix le plus bas.\nUn agent vous indiquera le meilleur prix actuel.",
    promo: "Oui, nous pouvons proposer des tarifs avantageux au départ de la France avec retour en France, ainsi que sur Lisbonne-Dhaka.\nNous pouvons également traiter d'autres destinations.\nLes meilleurs tarifs sont en général hors vacances et hors week-end.",
    default: "Bonjour, bienvenue chez AMI Voyages.\nJe peux vous aider pour : horaires, adresse, devis, prix, visa, bagages, modification de billet, paiement et vérification de dossier."
};

// Intents avec patterns précis et priorités
const intents = [
    { key: 'vol_annule_retarde', priority: 52, patterns: [/\b(vol|flight).*\b(annul|retard|delay|probleme)\b/i, /\b(annul|retard|delay|probleme).*(vol|flight|billet)\b/i] },
    { key: 'statut_vol', priority: 52, patterns: [/\b(statut|position|check|verif|confirm).*\b(vol|billet|flight|ticket)\b/i, /\b(reference|numero|num|ref).*(vol|billet|flight)\b/i] },
    { key: 'billet_modifier', priority: 50, patterns: [/\b(modif|changer|report|annuler|update).*(billet|vol|ticket|flight|voyage)\b/i, /\b(billet|vol|ticket|flight|voyage).*(modif|changer|annul|report|update)\b/i] },
    { key: 'dossier', priority: 50, patterns: [/\b(verif|check|numero|reference|ref).*(dossier)\b/i, /\b(dossier).*(verif|check|numero|reference|ref)\b/i] },

    { key: 'horaires', priority: 32, patterns: [/\b(horaire|horaires|heure)\b/i, /\b(quand|quel|quelle).*(ouvert|horaire|ferme)\b/i] },
    { key: 'adresse', priority: 30, patterns: [/\b(adresse|adresse\s+agence|localisation|localisation\s+agence|localise|situe)\b/i, /\b(ou\s+etes|ou\s+etes\s+vous|ou\s+se\s+trouve|ou\s+se\s+trouve\s+votre|ou\s+se\s+trouve\s+notre|ou\s+se\s+trouvent)\b/i] },
    { key: 'devis', priority: 30, patterns: [/\bdevis\b/i, /\b(devis|quote|estimation).*\b(prix|tarif|cout)\b/i] },

    { key: 'annulation_modification', priority: 28, patterns: [/\b(rembours|refund|remboursement)\b/i, /\b(annul|cancel).*(voyage|reservation|billet)\b/i] },

    { key: 'disponibilite_prix', priority: 26, patterns: [/\b(prix|tarif|co(u)?t|price|rate)\b/i] },
    { key: 'visa', priority: 23, patterns: [/\bvisa\b/i] },
    { key: 'bagage', priority: 22, patterns: [/\b(bagage|kilo|luggage|surbagage|excess)\b/i] },
    { key: 'paiement', priority: 22, patterns: [/\b(paiement|payer|payment|virement|cheque|carte)\b/i] },
    { key: 'siege', priority: 20, patterns: [/\b(siege|si[eè]ge|seat|place)s?\b/i, /\b(choisir|choix|selection|selectionner|select|reserver).*(siege|si[eè]ge|seat|place)\b/i, /\b(place).*(avion|vol|dans\s+l?avion)\b/i, /\b(seat\s*selection|select\s*seat)\b/i] },

    { key: 'omra_hajj', priority: 24, patterns: [/\b(omra|hajj|pelerinage|pilgrimage)\b/i] },
    { key: 'femme_enceinte', priority: 24, patterns: [/\b(enceinte|pregnant|grossesse)\b/i] },
    { key: 'bebe_bagage', priority: 19, patterns: [/\b(bebe|baby|infant).*(bagage|luggage|droit)\b/i, /\b(bagage|luggage).*(bebe|baby|infant)\b/i] },
    { key: 'bebe_billet', priority: 18, patterns: [/\b(bebe|enfant|child|infant).*\b(ticket|prix|tarif|categorie)\b/i] },
    { key: 'documents', priority: 17, patterns: [/\b(document|passeport|passport|papier)\b/i] },
    { key: 'destination', priority: 17, patterns: [/\b(destination|destinations|destinations\s+couvertes)\b/i, /\b(proposez[-\s]?vous|faites[-\s]?vous|travaillez[-\s]?vous|est[-\s]?ce).*(destination|destinations|senegal|bangladesh|dhaka|dakar)\b/i, /\b(proposez|faites|travaillez).*(senegal|bangladesh|dhaka|dakar)\b/i] },
    { key: 'bus', priority: 16, patterns: [/\b(bus|train|voiture|transport)\b/i] },
    { key: 'telephone', priority: 15, patterns: [/\b(telephone|tel|appel|appeler|appelez|appelle|nous\s+joindre|vous\s+joindre|contact|contacter)\b/i, /\b(numero\s+(de\s+)?(agence|telephone|tel))\b/i] },
    { key: 'delai', priority: 15, patterns: [/\b(delai|urgent|rapide|vite|asap)\b/i] },
    { key: 'paiement_distance', priority: 20, patterns: [/\b(paiement|payer|payment).*(distance|en\s+ligne|enligne|remote|remotely|ligne)\b/i] },

    { key: 'bagage_extra', priority: 14, patterns: [/\b(surbagage|supplement|suppl[eé]mentaire|extra)\b/i] },
    { key: 'bagage_enfant', priority: 13, patterns: [/\b(bagage).*(enfant|child)\b/i, /\b(enfant).*(bagage)\b/i] },
    { key: 'prix_moins_cher', priority: 12, patterns: [/\b(prix|tarif).*(bas|moins|promo|meilleur)\b/i] },
    { key: 'lien_paiement', priority: 11, patterns: [/\b(lien|link).*(paiement|payment)\b/i, /\b(facture|invoice)\b/i] },
    { key: 'rappel', priority: 10, patterns: [/\b(rappel|rappeler|reminder|callback|rappelez)\b/i] },
    { key: 'agent_disponible', priority: 9, patterns: [/\b(agent).*(disponible|occupe|busy)\b/i] },
    { key: 'duree_min', priority: 8, patterns: [/\b(duree|length).*(sejour|jour|days)\b/i] },

    { key: 'salutation', priority: 2, patterns: [/\b(bonjour|hello|hi|coucou|allo|salut)\b/i] }
];

function getBotReply(messageText) {
    const normalized = normalizeText(messageText);

    // Intents sensibles qui ne doivent JAMAIS être battus par des patterns vagues
    const sensibleIntents = [
        { key: 'vol_annule_retarde', regex: [/\b(vol|flight).*\b(annul|retard|delay|probleme)\b/i, /\b(annul|retard|delay|probleme).*(vol|flight|billet)\b/i] },
        { key: 'statut_vol', regex: [/\b(statut|position|check|verif|confirm).*\b(vol|billet|flight|ticket)\b/i, /\b(reference|numero|num|ref).*(vol|billet|flight)\b/i] },
        { key: 'billet_modifier', regex: [/\b(modif|changer|report|annuler|update).*(billet|vol|ticket|flight|voyage)\b/i, /\b(billet|vol|ticket|flight|voyage).*(modif|changer|annul|report|update)\b/i] },
        { key: 'dossier', regex: [/\b(verif|check|numero|reference|ref).*(dossier)\b/i, /\b(dossier).*(verif|check|numero|reference|ref)\b/i] }
    ];

    // Vérifier les intents sensibles EN PREMIER
    for (const sensible of sensibleIntents) {
        for (const regex of sensible.regex) {
            if (regex.test(normalized)) {
                console.log(`[BOT] Intent sensible détecté: ${sensible.key} (protégé)`);
                return responses[sensible.key] || responses.default;
            }
        }
    }

    // Calculer les scores pour tous les intents
    let intentScores = [];

    for (const intent of intents) {
        let matchCount = 0;

        for (const pattern of intent.patterns) {
            if (pattern.test(normalized)) {
                matchCount++;
            }
        }

        if (matchCount > 0) {
            const score = matchCount + intent.priority;
            intentScores.push({ key: intent.key, score, matchCount, priority: intent.priority });
        }
    }

    // Appliquer les règles métier
    const hasAdresse = intentScores.some(s => s.key === 'adresse');
    const hasHoraires = intentScores.some(s => s.key === 'horaires');
    const hasDevis = intentScores.some(s => s.key === 'devis');
    const hasPrix = intentScores.some(s => s.key === 'disponibilite_prix');
    const hasBonjour = intentScores.some(s => s.key === 'salutation');

    // Règle 1: adresse + horaires => horaires
    if (hasAdresse && hasHoraires) {
        console.log(`[BOT] Règle: adresse + horaires => horaires`);
        return responses.horaires;
    }

    // Règle 2: devis + prix => devis
    if (hasDevis && hasPrix) {
        console.log(`[BOT] Règle: devis + prix => devis`);
        return responses.devis;
    }

    // Règle 3: bonjour seul vs bonjour + vraie demande
    if (hasBonjour && intentScores.length === 1) {
        return responses.salutation;
    }

    // Si bonjour + autre chose, ignorer salutation
    if (hasBonjour && intentScores.length > 1) {
        intentScores = intentScores.filter(s => s.key !== 'salutation');
        console.log(`[BOT] Règle: bonjour + demande => ignorer salutation`);
    }

    // Trier par score décroissant
    intentScores.sort((a, b) => b.score - a.score);

    if (intentScores.length > 0) {
        const topIntent = intentScores[0];
        console.log(`[BOT] Intent: ${topIntent.key} (score: ${topIntent.score})`);
        return responses[topIntent.key] || responses.default;
    }

    return responses.default;
}

async function sendWhatsAppMessage(to, message) {
    const url = `https://graph.facebook.com/v17.0/${process.env.PHONE_NUMBER_ID}/messages`;

    try {
        const payload = {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { preview_url: false, body: message }
        };

        const response = await axios.post(url, payload, {
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('[WHATSAPP] Message envoyé, id:', response.data.messages?.[0]?.id || 'aucun id');
    } catch (error) {
        console.error('[WHATSAPP] Erreur envoi message:', error.response?.data || error.message);
        throw error;
    }
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
