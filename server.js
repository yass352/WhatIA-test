const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const UNSUPPORTED_MEDIA_REPLY = "Désolé, je ne peux pas traiter ce type de média ici.";
const HANDOFF_ACK = 'Merci pour ces informations. Un conseiller AMI Voyages reprendra votre demande et vous recontactera dès que possible.';

// Simple in-memory session store (optional short-term memory)
const SESSIONS = new Map();

function saveSession(user, data) {
  const s = SESSIONS.get(user) || {};
  Object.assign(s, data);
  SESSIONS.set(user, s);
}

function getSession(user) {
  return SESSIONS.get(user) || {};
}

function clearSession(user) {
  SESSIONS.delete(user);
}

function isPhoneNumber(text) {
  if (!text) return false;
  const digits = String(text).replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

function looksLikeReference(text) {
  if (!text) return false;
  const s = String(text || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!/^[A-Z0-9]{6,10}$/.test(s)) return false;
  if (!/[A-Z]/.test(s) || !/[0-9]/.test(s)) return false;
  const blacklist = ['CONTACT', 'REFERENCE', 'NUMERO', 'PHONE', 'TEL', 'AGENT'];
  for (const b of blacklist) if (s.includes(b)) return false;
  return true;
}

function looksLikeContactInfo(text) {
  const t = String(text || '').toLowerCase();
  if (isPhoneNumber(t)) return true;
  if (/\b(ref|réf|reference|pnr|numéro|numero|billet)\b/.test(t)) return true;
  if (looksLikeReference(t) && /[0-9]/.test(t)) return true;
  return false;
}

// Final granular INTENTS (single declaration)
const INTENTS = [
  { name: 'vol_annule_retarde', priority: 110, handoff: true, tests: [/\bvol\s+annul(?:[ée])\b/i, /\bvol\s+retard\b/i, /\bannule\s+mon\s+vol\b/i], response: 'Nous sommes désolés pour la gêne occasionnée.\nMerci d’indiquer votre référence de dossier, votre numéro de téléphone et le nom du passager, un conseiller prendra ensuite votre demande dès que possible.' },
  { name: 'statut_confirmation_vol', priority: 105, handoff: true, tests: [/\bstatut\s+de\s+mon\s+vol\b/i, /\best[- ]ce\s+que\s+mon\s+vol\s+est\s+confirm/i, /\bmon\s+vol\s+est\s+confirm\b/i], response: 'Merci de nous envoyer la référence de votre billet, le numéro de billet, la référence de votre facture ou la copie du passeport du passager, s’il vous plaît. Un conseiller AMI Voyages prendra ensuite le relais. Sinon vous pouvez regarder sur le site des compagnies aériennes, Votre vol est avec quel compagnies aériennes ? ' },
  { name: 'annulation_changement', priority: 103, handoff: true, tests: [/\bannuler\s+mon\s+billet\b/i, /\bannulation\b.*\bvol\b/i, /\bmodifier\s+mon\s+vol\b/i, /\bchanger\s+mon\s+vol\b/i], response: 'Les conditions d’annulation ou de modification dépendent du billet réservé, de la compagnie aérienne et des règles tarifaires.\nSi vous avez déjà un dossier, envoyez-nous votre référence ou votre numéro et le nom du passager. Un conseiller AMI Voyages prendra ensuite le relais.' },
  { name: 'verification_dossier', priority: 102, handoff: true, tests: [/\bverif(?:ier|ication)\s+de\s+(?:mon\s+)?dossier\b/i, /\bstatut\s+de\s+mon\s+dossier\b/i], response: 'Oui, un conseiller peut vérifier votre dossier.\nMerci d’indiquer votre référence de dossier ainsi que le nom du passager. Un conseiller AMI Voyages prendra ensuite le relais.' },
  { name: 'modification_billet_existant', priority: 101, handoff: true, tests: [/\bmodifier\s+le\s+billet\b/i, /\bchanger\s+la\s+date\s+du\s+vol\b/i, /\bmodifier\s+un\s+billet\s+existant\b/i], response: 'Oui, cela doit être vérifié par un conseiller.\nMerci d’indiquer votre référence de dossier ainsi que votre demande de modification. Un conseiller AMI Voyages prendra ensuite le relais.' },
  { name: 'prix_disponibilite', priority: 100, handoff: true, tests: [/\b(prix|tarif)s?\b.*\b(disponib|disponibil)\b/i, /\bavez[- ]?vous\s+des\s+places\b/i, /\bprix\s+et\s+disponibilite\b/i], response: 'Les prix varient selon la destination, la date, la compagnie aérienne et les places disponibles.\nMerci de nous indiquer :\nvotre destination,\nvotre ville de départ et votre ville de retour,\nvos dates de départ et de retour,\nle nombre de passagers,\nvotre préférence éventuelle : compagnie aérienne, vol direct ou prix le plus bas. Un conseiller AMI Voyages prendra ensuite le relais.' },
  { name: 'devis', priority: 99, handoff: true, tests: [/\bdevis\b/i, /\bje\s+veux\s+un\s+devis\b/i, /\bbesoin\s+de\s+devis\b/i], response: 'Oui, nous pouvons transmettre votre demande à un conseiller.\nMerci d’indiquer :\nvotre destination,\nvotre ville de départ et votre ville de retour,\nvos dates,\nle nombre de passagers,\nvotre numéro de téléphone. Un conseiller AMI Voyages prendra ensuite le relais.' },
  { name: 'paiement_conditions', priority: 98, handoff: true, tests: [/\b(moyens|conditions?)\s+de\s+paiement\b/i, /\bmodalit\w*\s+de\s+paiement\b/i, /\bcomment\s+payer\b/i], response: 'Nous acceptons les virements bancaires, les espèces, les chèques ancv, ainsi que les chèques-vacances / Connect.\nNous pouvons aussi vous envoyer un lien de paiement en ligne.\nSelon le dossier, un paiement en plusieurs fois peut être possible, sous condition.' },
  { name: 'paiement_distance', priority: 97, handoff: true, tests: [/\bpaiement\s+a\s+distance\b/i, /\bpaiement\s+en\s+ligne\b/i, /\btelepaiement\b/i], response: 'Selon le dossier, un paiement à distance est possible par carte bancaire via un lien de paiement sécurisé.\nMerci de nous indiquer votre facture d’achat, ou à défaut la copie du passeport du passager. Un conseiller AMI Voyages prendra ensuite le relais.' },
  { name: 'lien_paiement', priority: 97, handoff: true, tests: [/\blien\s+de\s+paiement\b/i, /\benvoyer\s+un\s+lien\s+de\s+paiement\b/i], response: 'Merci de nous indiquer votre facture d’achat, ou à défaut la copie du passeport du passager. Un conseiller AMI Voyages prendra ensuite le relais.' },
  { name: 'visa', priority: 96, handoff: true, tests: [/\bvisa\b/i, /\bdemande\s+de\s+visa\b/i, /\bvisa\s+pour\b/i], response: 'Oui, nous proposons une assistance visa pour certaines destinations uniquement.\nIndiquez-nous votre destination et votre nationalité afin de vérifier si nous pouvons vous aider. Un conseiller AMI Voyages prendra ensuite le relais.' },
  { name: 'documents_voyage', priority: 95, handoff: true, tests: [ /\bdocuments?\s+pour\s+voyager\b/i, /\bdocuments?\s+requis\b/i, /\bpasseport\b.*\bvalide\b/i, /\bquels?\s+(documents|papiers)\b/i ], response: 'Les documents nécessaires dépendent de la destination, de votre nationalité et du type de voyage.\nIndiquez-nous votre destination et votre nationalité afin que nous puissions vous orienter. Un conseiller AMI Voyages prendra ensuite le relais.' },
  { name: 'omra_hajj', priority: 94, handoff: true, tests: [/\bomra\b/i, /\bhajj\b/i, /\bomra\s+et\s+hajj\b/i], response: 'Oui, nous pouvons vous accompagner pour les voyages omra et hajj selon la période et les disponibilités.\nSi vous souhaitez connaître les tarifs, merci de nous indiquer :\nvotre destination,\nvotre ville de départ et votre ville de retour,\nvos dates de départ et de retour,\nle nombre de passagers. Un conseiller AMI Voyages prendra ensuite le relais.' },
  { name: 'grossesse', priority: 93, handoff: true, tests: [/\bfemme\s+enceinte\b/i, /\bgrossesse\b.*\bvoyage\b/i, /\benceinte\b/i], response: 'Les femmes enceintes peuvent voyager en général jusqu’à 6 mois.\nAu-delà, il faut une autorisation médicale, sous réserve d’acceptation de la compagnie aérienne et des services aéroportuaires. Vous pouvez également demander à votre médecin. ' },
  { name: 'bebe_tarif', priority: 92, handoff: true, tests: [/\bbebe\s+tarif\b/i, /\btarif\s+pour\s+un\s+bebe\b/i, /\btarif\s+bebe\b/i], response: 'De 1 jour à moins de 2 ans, le passager est considéré dans la catégorie bébé.\nIl paie généralement les taxes aéroport, selon les conditions du billet.\nÀ partir de 2 ans jusqu’à moins de 12 ans, il est considéré comme enfant.\nÀ partir de 12 ans, il est considéré comme adulte.' },
  { name: 'bebe_bagage', priority: 92, handoff: true, tests: [/\bbebe\s+bagage\b/i, /\bbagage\s+pour\s+bebe\b/i, /\bbagage\s+de\s+bebe\b/i], response: 'Oui, en général, ils ont droit à des bagages.\nCela dépend de la compagnie aérienne.\nSauf chez Saudia Airlines, où c’est 23 kilos.' },
  { name: 'enfant_bagage', priority: 92, handoff: true, tests: [/\benfant\s+bagage\b/i, /\bbagage\s+enfant\b/i, /\bbagage\s+pour\s+enfant\b/i], response: 'Les bagages pour les enfants suivent généralement les mêmes normes que pour les adultes mais cela peut dépendre de la compagnie aérienne.' },
  { name: 'rappel_client', priority: 91, handoff: true, tests: [/\bpouvez[- ]?vous\s+me\s+rappeler\b/i, /\bme\s+rappeler\b/i, /\bdemande\s+de\s+rappel\b/i], response: 'Oui, nous pouvons transmettre votre demande à un conseiller.\nMerci d’indiquer votre nom et le sujet de votre demande. Un conseiller AMI Voyages prendra le relais.' },
  { name: 'projet_voyage', priority: 79, handoff: true, tests: [/\bje\s+veux\s+(?:aller|voyager|partir)\b/i, /\bje\s+cherche\b.*\b(?:vol|voyage|billet)\b/i, /\bbillet\s+pour\b/i, /\bpartir\s+(?:pour|en|a|au|aux|vers)\b/i, /\bvoyager\s+(?:pour|en|a|au|aux|vers)\b/i], response: 'Nous pouvons vous aider à organiser votre voyage. Merci de nous indiquer votre destination, votre ville de départ, vos dates de départ et de retour, et le nombre de passagers. Un conseiller AMI Voyages prendra ensuite le relais.' },
  { name: 'horaires_ouverture', priority: 80, handoff: false, tests: [/\bhoraire\s+ouverture\b/i, /\bhoraires?\b.*\bouverture\b/i, /\bquels\s+sont\s+vos\s+horaires\b/i, /\bvous\s+etes\s+ouvert\b/i, /\bvous\s+etes\s+ouvert\s+quand\b/i, /\bcest\s+ouvert\b/i, /\bouvrez\s+quand\b/i, /\bfermez\s+a\s+quelle\s+heure\b/i, /\btravaillez\s+aujourd hui\b/i, /\bvous\s+etes\s+la\b/i], response: 'Bonjour, nos horaires sont les suivants :\nAMI Voyages Paris Gare du Nord, 157 rue Lafayette, 75010 Paris ouvert du lundi au samedi de 10h00 à 18h30.\nAMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République, 93300 Aubervilliers ouvert du mardi au vendredi de 10h00 à 18h30.\nVous pouvez aussi nous écrire ici sur WhatsApp.' },
  { name: 'localisation_agences', priority: 75, handoff: false, tests: [/\blocalisation\b.*\bagence\b/i, /\badresse\b.*\bagence\b/i, /\bagence[s]?\b.*\bParis\b/i, /\bAubervilliers\b/i], response: 'Bonjour, voici nos agences :\nAMI Voyages Paris Gare du Nord, 157 rue Lafayette, 75010 Paris ouvert du lundi au samedi de 10h00 à 18h30.\nAMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République, 93300 Aubervilliers ouvert du mardi au vendredi de 10h00 à 18h30.\nVous pouvez aussi nous écrire ici sur WhatsApp.' },
  { name: 'destination_couverte', priority: 70, handoff: false, tests: [/\bbangladesh\b/i, /\binde\b/i, /\bSri\s+Lanka\b/i, /\bMali\b/i, /\bS[eé]n[eé]gal\b/i, /\bGuin[eé]e\b/i, /\bRDC\b/i, ], response: 'Oui, nous travaillons sur cette destination.\nMerci de nous indiquer :\nvotre ville de départ et votre ville de retour,\nvos dates de départ et de retour,\nle nombre de passagers,\nvotre préférence éventuelle : compagnie aérienne, vol direct ou prix le plus bas.\nUn agent vous indiquera le meilleur prix actuel.' },
  { name: 'promos', priority: 65, handoff: false, tests: [/\bpromo[s]?\b/i, /\boffre[s]?\s+special/i, /\bFrance\b.*\bLisbonne\b.*\bDhaka\b/i, /\bLisbonne[- ]Dhaka\b/i], response: 'Oui, nous pouvons proposer des tarifs avantageux au départ de la France avec retour en France, ainsi que sur Lisbonne-Dhaka.\nNous pouvons également traiter d’autres destinations.\nLes meilleurs tarifs sont en général hors vacances et hors week-end.\nSi vous souhaitez connaître les tarifs, merci de nous indiquer :\nvotre destination,\nvotre ville de départ et votre ville de retour,\nvos dates de départ et de retour,\nle nombre de passagers,\nvotre préférence éventuelle : compagnie aérienne, vol direct ou prix le plus bas.\nUn agent vous indiquera le meilleur prix actuel.' },
  { name: 'bus', priority: 64, handoff: false, tests: [/\bfaites[- ]?vous.*bus\b/i, /\bbus\b/i, /\btrain\b/i], response: 'Non, nous proposons uniquement des voyages aériens.\nNotre agence est spécialisée dans les destinations d’Asie du Sud, comme le Bangladesh, l’Inde et le Sri Lanka, ainsi que d’Afrique subsaharienne, comme le Mali, le Sénégal, la Guinée ou la RDC.' },
  { name: 'appel_non_repondu', priority: 60, handoff: false, tests: [/\bvous\s+ne\s+repondez\s+pas\b/i, /\bje\s+n'?arrive\s+pas\s+a\s+vous\s+joindre\b/i, /\blignes?\s+sont\s+occupe(?:es)?\b/i, /\bje\s+vous\s+ai\s+appele\b/i, /\bvous\s+m'?avez\s+pas\s+repondu\b/i, /\bappel\s+manque\b/i, /\bpersonne\s+ne\s+repond\b/i, /\bjai\s+appele\b/i, /\bje\s+vous\s+appelle\s+depuis\s+ce\s+matin\b/i], response: 'Nous sommes désolés si vous n’avez pas reçu de réponse rapide.\nPouvez-vous nous préciser votre demande ou nous laisser votre numéro ? Un conseiller AMI Voyages reviendra vers vous dès que possible.' },
  { name: 'agent_disponible', priority: 58, handoff: false, tests: [/\bagent\s+disponible\b/i, /\bconseiller\s+disponible\b/i, /\best\s+quelqu'un\s+disponible\b/i], response: 'Tous nos agents sont disponibles selon leur planning. Nous faisons de notre mieux pour répondre dans les meilleurs délais pendant les horaires d’ouverture.\nEn dehors de ces horaires, vous pouvez déjà nous laisser votre demande ici sur WhatsApp.' },
  { name: 'delai_reponse', priority: 55, handoff: false, tests: [/\bdelai\s+de\s+reponse\b/i, /\bcombien\s+de\s+temps\s+pour\s+repondre\b/i, /\ben\s+combien\s+de\s+temps\b/i], response: 'Nous faisons de notre mieux pour répondre dans les meilleurs délais pendant les horaires d’ouverture.\nEn dehors de ces horaires, vous pouvez déjà nous laisser votre demande ici sur WhatsApp.' },
  { name: 'duree_minimum', priority: 50, handoff: false, tests: [/\bduree\s+minimum\b/i, /\bminimum\s+de\s+jours\b/i, /\bsejour\s+minimum\b/i], response: 'En Asie, c’est généralement 5 à 7 jours.\nEn Afrique, c’est généralement 3 jours, selon la compagnie aérienne.' },
  {
    name: 'salutation', priority: 40, handoff: false, tests: [/\bbonjour\b/i, /\bsalut\b/i, /\bbjr\b/i, /\bhi\b/i, /\bhello\b/i, /\bslt\b/i],
    response: 'Bonjour, bienvenue chez AMI Voyages.\nNous sommes une agence de voyages spécialisée dans les vols en direction de l’Asie du Sud et de l’Afrique subsaharienne.\nEn quoi puis-je vous aider ?\nSi vous souhaitez connaître les tarifs, merci de nous indiquer :\nvotre destination,\nvotre ville de départ et votre ville de retour,\nvos dates de départ et de retour,\nle nombre de passagers,\nvotre préférence éventuelle : compagnie aérienne, vol direct ou prix le plus bas.\nUn agent vous indiquera le meilleur prix actuel.'
  }, {
    name: 'salam', priority: 40, handoff: false, tests: [/\bsalam\b/i, /\bsalam aleykoum\b/i, /\bsalamalaikoum\b/i, /\bsalamualaikoum\b/i,/\bAs-Salamu'alaikum\b/i, /\bSalam alaikum\b/i, /\bAssalamulaikum\b/i, /\bASalamu aleykum\b/i, /\bSlm\b/i], response: 'Walaikum assalam, bienvenue chez AMI Voyages.\nNous sommes une agence de voyages spécialisée dans les vols en direction de l’Asie du Sud et de l’Afrique subsaharienne.\nEn quoi puis-je vous aider ?\nSi vous souhaitez connaître les tarifs, merci de nous indiquer :\nvotre destination,\nvotre ville de départ et votre ville de retour,\nvos dates de départ et de retour,\nle nombre de passagers,\nvotre préférence éventuelle : compagnie aérienne, vol direct ou prix le plus bas.\nUn agent vous indiquera le meilleur prix actuel.'
  },

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

function parseLeadingGreeting(text = '') {
  const normalized = normalizeText(text);
  const patterns = [
    { prefix: 'Bonjour', regex: /^(?:bonjour|salut|bjr|hi|hello|slt)\b[\s,]*(.*)$/ },
    { prefix: 'Walaikum assalam', regex: /^(?:salam(?:\s+aleykoum|\s+alaikum)?|salamalaikoum|salamualaikoum|as\s*salamu(?:\s+aleykoum|\s+alaikum|\s+alaykum)?|assalamulaikum|asalamu\s+aleykum|asalamu\s+alaykum|slm)\b[\s,]*(.*)$/ }
  ];
  for (const { prefix, regex } of patterns) {
    const match = normalized.match(regex);
    if (match) {
      const rest = String(match[1] || '').trim();
      return { greeting: prefix, rest, isOnlyGreeting: rest.length === 0 };
    }
  }
  return { greeting: null, rest: String(text || '').trim(), isOnlyGreeting: false };
}

function prefixResponse(greeting, response) {
  if (!greeting) return String(response || '');
  const trimmed = String(response || '').trim();
  if (!trimmed) return trimmed;
  if (trimmed.toLowerCase().startsWith(greeting.toLowerCase())) return trimmed;
  return `${greeting}, ${trimmed}`;
}

function extractTravelDestination(text = '') {
  const normalized = normalizeText(text);
  const patterns = [
    /\b(?:je\s+veux\s+(?:aller|voyager|partir)\s+(?:en|a|au|aux|vers|pour)\s+([a-z][a-z\s]{1,60}))/,
    /\b(?:je\s+cherche\s+(?:un\s+vol\s+)?(?:pour|en|a|au|aux|vers)\s+([a-z][a-z\s]{1,60}))/,
    /\b(?:billet\s+pour\s+([a-z][a-z\s]{1,60}))/,
    /\b(?:partir\s+(?:pour|en|a|au|aux|vers)\s+([a-z][a-z\s]{1,60}))/,
    /\b(?:voyager\s+(?:pour|en|a|au|aux|vers)\s+([a-z][a-z\s]{1,60}))/
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return '';
}

function detectIntent(message = '') {
  const normalizedMessage = normalizeText(message);
  for (const intent of INTENTS) {
    try {
      if (intent.tests.some((regex) => regex.test(normalizedMessage))) {
        return intent;
      }
    } catch (e) {
      // ignore regex errors
    }
  }
  return null;
}

async function generateTravelReply(messageText, sender) {
  const safeText = String(messageText || '').trim();
  if (!safeText) return "Pouvez-vous me préciser votre demande ? Un agent AMI Voyages prendra ensuite le relais.";

  const { greeting, rest, isOnlyGreeting } = parseLeadingGreeting(safeText);
  const cleanText = rest || safeText;

  if (isOnlyGreeting) {
    const intent = detectIntent(cleanText);
    return intent ? intent.response : prefixResponse(greeting, "Pouvez-vous me préciser votre demande ? Un agent AMI Voyages prendra ensuite le relais.");
  }

  if (sender) {
    const session = getSession(sender);
    if (session.awaitingContact && looksLikeContactInfo(cleanText)) {
      clearSession(sender);
      return HANDOFF_ACK;
    }
  }

  const intent = detectIntent(cleanText);
  if (intent) {
    if (intent.name === 'projet_voyage') {
      const destination = extractTravelDestination(cleanText);
      if (destination) {
        return prefixResponse(greeting, `Super, nous pouvons vous aider à organiser votre voyage vers ${destination}. Merci de nous indiquer votre ville de départ, vos dates de départ et de retour, et le nombre de passagers. Un conseiller AMI Voyages prendra ensuite le relais.`);
      }
    }
    if (intent.handoff && sender) {
      saveSession(sender, { awaitingContact: true, intent: intent.name, timestamp: Date.now() });
    }
    return prefixResponse(greeting, intent.response);
  }

  return prefixResponse(greeting, "Pouvez-vous me préciser votre demande ? Un agent AMI Voyages prendra ensuite le relais.");
}

async function handleTextMessage(text, sender) {
  return await generateTravelReply(text, sender);
}

async function transcribeAudio(filePath) {
  try {
    return '[transcription indisponible]';
  } catch (e) {
    return '';
  }
}

async function downloadFile(url, destPath) {
  const writer = fs.createWriteStream(destPath);
  const response = await axios.get(url, { responseType: 'stream', headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function handleAudioMessage(message, sender) {
  try {
    const media = message?.audio || message?.voice || null;
    const mediaId = media?.id || message?.id || null;
    if (!mediaId) return UNSUPPORTED_MEDIA_REPLY;

    const mediaUrlResp = await axios.get(`https://graph.facebook.com/v17.0/${mediaId}`, { params: { access_token: process.env.WHATSAPP_TOKEN } });
    const mediaUrl = mediaUrlResp.data?.url;
    if (!mediaUrl) return UNSUPPORTED_MEDIA_REPLY;

    const tmpPath = `./tmp_${Date.now()}.ogg`;
    await downloadFile(mediaUrl, tmpPath);
    const transcription = await transcribeAudio(tmpPath);
    try { await fs.promises.unlink(tmpPath); } catch (e) { }

    if (!transcription) return "Je n'ai pas réussi à transcrire l'audio. Pouvez-vous réessayer en texte ?";
    return await generateTravelReply(transcription, sender);
  } catch (e) {
    console.warn('[AUDIO] erreur:', e.message || e);
    return "Erreur lors du traitement audio. Un agent prendra le relais si nécessaire.";
  }
}

function sanitizeReply(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
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
      return res.status(200).send('Ignore non-WhatsApp event');
    }

    const value = body.entry[0].changes[0].value;
    const messages = value.messages || [];
    if (!messages.length) {
      return res.status(200).send('No messages');
    }

    const message = messages[0];
    const sender = message.from;
    let replyText = '';

    if (message.type === 'text' && message.text?.body) {
      replyText = await handleTextMessage(message.text.body, sender);
    } else if (['audio', 'voice'].includes(message.type)) {
      replyText = await handleAudioMessage(message, sender);
    } else if (message.type === 'sticker' || message.type === 'image' || message.type === 'video' || message.type === 'document' || message.type === 'location' || message.type === 'contacts') {
      replyText = UNSUPPORTED_MEDIA_REPLY;
    } else {
      replyText = "Je n’ai pas pu traiter votre message. Un conseiller AMI Voyages va prendre la suite si besoin.";
    }

    await sendWhatsAppText(sender, replyText);
    res.status(200).send('OK');
  } catch (error) {
    console.error('[WEBHOOK] Erreur traitement', error);
    res.status(500).send('Server error');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
