const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
 
dotenv.config();
 
const app = express();
app.use(express.json());
 
const PORT = process.env.PORT || 3000;
 
// =====================================================================
// NORMALISATION DU TEXTE
// =====================================================================
// Met en minuscules, retire les accents, retire la ponctuation,
// compresse les espaces, et corrige quelques salutations SMS très
// frequentes et non ambigues (pour que parseLeadingGreeting fonctionne
// proprement). Les fautes sur les mots-cles metier sont gerees directement
// dans les regex de chaque intent, pas ici, pour ne pas fausser la
// detection de langue.
function normalizeText(text) {
  let s = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
 
  const greetingFixes = {
    bjr: 'bonjour', bnjr: 'bonjour', bjrr: 'bonjour', bonjor: 'bonjour', bonjou: 'bonjour',
    slt: 'salut',
    slm: 'salam',
    salamalaykoum: 'salam aleykoum', salamaleykoum: 'salam aleykoum', salamalaikoum: 'salam aleykoum',
    assalamoualaykoum: 'salam aleykoum', assalamoualaikoum: 'salam aleykoum', assalamualaikum: 'salam aleykoum',
    assalamualaykum: 'salam aleykoum'
  };
 
  s = s.split(' ').map((w) => greetingFixes[w] || w).join(' ');
  return s;
}
 
// =====================================================================
// DETECTION DE LA LANGUE (vote de mots-cles FR vs EN, defaut FR)
// =====================================================================
const FRENCH_LANG_WORDS = new Set([
  'bonjour', 'salut', 'bonsoir', 'coucou', 'merci', 'svp', 'stp', 'plait',
  'besoin', 'vouloir', 'veux', 'voudrais', 'aimerais', 'souhaite', 'comment',
  'quoi', 'quand', 'ou', 'pourquoi', 'combien', 'combient', 'cbien', 'oui', 'non',
  'vol', 'billet', 'bilet', 'billets', 'voyage', 'voyager', 'destination', 'date',
  'dates', 'prix', 'pri', 'tarif', 'tarf', 'tarifs', 'reservation', 'dossier',
  'disponible', 'dispo', 'disponibilite', 'confirmer', 'confirme', 'confirmation',
  'annuler', 'annuller', 'annulation', 'anulasion', 'modifier', 'modif', 'changer',
  'changement', 'chnage', 'informations', 'contact', 'telephone', 'numero', 'reference',
  'paiement', 'payer', 'visa', 'passeport', 'documents', 'bebe',
  'enceinte', 'grossesse', 'bagage', 'bagages', 'aller', 'partir', 'agence', 'horaires',
  'horaire', 'heur', 'adresse', 'agent', 'conseiller', 'humain', 'rappel', 'rappeler',
  'devis', 'depart', 'retour', 'passager', 'passagers', 'jveux', 'jveu'
]);
 
// Note : 'pasport'/'visa'/'dispo' sont volontairement absents des deux listes
// car trop ambigus pour trancher fiablement la langue.
 
const ENGLISH_LANG_WORDS = new Set([
  'hello', 'hi', 'hey', 'please', 'pls', 'thanks', 'thank', 'thx', 'ty', 'you', 'u',
  'need', 'want', 'would', 'like', 'how', 'what', 'when', 'where', 'why', 'much',
  'yes', 'no', 'flight', 'ticket', 'tickets', 'travel', 'destination', 'date', 'dates',
  'price', 'prices', 'fare', 'fares', 'booking', 'reservation', 'available', 'availability',
  'availible', 'confirm', 'confirmed', 'confirmation', 'cancel', 'cancell', 'canceled',
  'cancelled', 'cancellation', 'modify', 'change', 'information', 'contact', 'phone',
  'number', 'reference', 'payment', 'pay', 'visa', 'passport', 'documents', 'document',
  'baby', 'pregnant', 'pregnancy', 'luggage', 'baggage', 'go', 'departure', 'return',
  'passenger', 'passengers', 'quote', 'agent', 'human', 'customer', 'service', 'call',
  'back', 'hours', 'opening', 'address', 'office'
]);
 
function detectLanguage(text = '') {
  const normalized = normalizeText(text);
  const words = normalized.split(' ').filter(Boolean);
 
  let frCount = 0;
  let enCount = 0;
  for (const w of words) {
    if (FRENCH_LANG_WORDS.has(w)) frCount++;
    if (ENGLISH_LANG_WORDS.has(w)) enCount++;
  }
 
  return enCount > frCount ? 'en' : 'fr';
}
 
// =====================================================================
// TEXTES SYSTEME BILINGUES
// =====================================================================
const TEXTS = {
  fr: {
    unsupported_media: "Désolé, je ne peux pas traiter ce type de fichier pour le moment. Vous pouvez me décrire votre demande par écrit.",
    handoff_ack: "Merci pour ces informations, elles sont bien notées. Un conseiller AMI Voyages va prendre en charge votre dossier et vous recontactera très prochainement.",
    no_transcription: "Je n'ai pas réussi à comprendre votre message vocal. Pourriez-vous le réécrire en texte, s'il vous plaît ?",
    audio_error: "Une erreur est survenue pendant le traitement de votre message vocal. Un conseiller pourra vous aider si besoin.",
    empty_message: "Je suis à votre écoute : pourriez-vous préciser votre demande ? Un conseiller AMI Voyages pourra ensuite vous accompagner.",
    unknown_message: "Je n'ai pas tout à fait compris votre demande, mais ne vous inquiétez pas : un conseiller AMI Voyages va prendre le relais pour vous aider."
  },
  en: {
    unsupported_media: "Sorry, I can't process this type of file right now. Feel free to describe your request in writing.",
    handoff_ack: "Thank you, this information has been noted. An AMI Voyages advisor will take over your file and get back to you very soon.",
    no_transcription: "I couldn't understand your voice message. Could you please write it as text instead?",
    audio_error: "Something went wrong while processing your voice message. An advisor can help if needed.",
    empty_message: "I'm listening: could you tell me more about what you need? An AMI Voyages advisor will then assist you.",
    unknown_message: "I didn't quite understand your request, but don't worry: an AMI Voyages advisor will take over to help you."
  }
};
 
function t(lang = 'fr', key = '', vars = {}) {
  const text = TEXTS[lang]?.[key] || TEXTS['fr']?.[key] || '';
  let result = text;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(`{${k}}`, v);
  }
  return result;
}
 
// =====================================================================
// SESSIONS MEMOIRE COURTE
// =====================================================================
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
 
// =====================================================================
// PROTECTION ANTI-DOUBLONS WEBHOOK
// =====================================================================
const PROCESSED_MESSAGES = new Map();
 
function isMessageProcessed(id, windowMs = 5 * 60 * 1000) {
  if (!id) return false;
  const ts = PROCESSED_MESSAGES.get(id);
  if (!ts) return false;
  if (Date.now() - ts < windowMs) return true;
  PROCESSED_MESSAGES.delete(id);
  return false;
}
 
function markMessageProcessed(id) {
  if (!id) return;
  PROCESSED_MESSAGES.set(id, Date.now());
}
 
setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of PROCESSED_MESSAGES) {
    if (now - ts > 15 * 60 * 1000) PROCESSED_MESSAGES.delete(id);
  }
}, 10 * 60 * 1000);
 
// =====================================================================
// DETECTION DE CONTACT / REFERENCE
// =====================================================================
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
  const blacklist = ['CONTACT', 'REFERENCE', 'NUMERO', 'PHONE', 'TEL', 'AGENT', 'BOOKING', 'TICKET'];
  for (const b of blacklist) if (s.includes(b)) return false;
  return true;
}
 
function looksLikeContactInfo(text) {
  const lower = String(text || '').toLowerCase();
  if (isPhoneNumber(lower)) return true;
  if (/\b(ref|reference|pnr|numero|billet|booking|ticket)\b/.test(lower)) return true;
  if (looksLikeReference(lower) && /[0-9]/.test(lower)) return true;
  return false;
}
 
// =====================================================================
// EXTRACTION DE DESTINATION
// =====================================================================
function extractTravelDestination(text = '') {
  const normalized = normalizeText(text);
  const patterns = [
    /\b(?:je veux|je voudrais|jveux|jveu|j aimerais|je souhaite)\s+(?:aller|voyager|partir)\s+(?:en|a|au|aux|vers|p(?:ou)?r)\s+([a-z][a-z\s]{1,60})/,
    /\bje cherche\s+(?:un vol\s+)?(?:p(?:ou)?r|en|a|au|aux|vers)\s+([a-z][a-z\s]{1,60})/,
    /\bbil(?:l)?et\s+p(?:ou)?r\s+([a-z][a-z\s]{1,60})/,
    /\bvol\s+p(?:ou)?r\s+([a-z][a-z\s]{1,60})/,
    /\bpartir\s+(?:p(?:ou)?r|en|a|au|aux|vers)\s+([a-z][a-z\s]{1,60})/,
    /\bvoyager\s+(?:p(?:ou)?r|en|a|au|aux|vers)\s+([a-z][a-z\s]{1,60})/,
    /\bdispo(?:nible)?\s+p(?:ou)?r\s+([a-z][a-z\s]{1,60})/,
    /\b(?:i want|i d like|i would like|i need)\s+(?:to\s+)?(?:go|travel|fly)\s+to\s+([a-z][a-z\s]{1,60})/,
    /\btravel\s+to\s+([a-z][a-z\s]{1,60})/,
    /\bticket\s+to\s+([a-z][a-z\s]{1,60})/,
    /\bflight\s+to\s+([a-z][a-z\s]{1,60})/,
    /\bprice\s+for\s+([a-z][a-z\s]{1,60})/
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return '';
}
 
// =====================================================================
// SALUTATIONS EN DEBUT DE MESSAGE
// =====================================================================
function parseLeadingGreeting(text = '', lang = 'fr') {
  const normalized = normalizeText(text);
  const patterns = lang === 'en'
    ? [{ prefix: 'Hello', regex: /^(?:hello|hi|hey|good morning|good afternoon|good evening)\b[\s,]*(.*)$/ }]
    : [
        { prefix: 'Bonjour', regex: /^(?:bonjour|salut|coucou|bonsoir)\b[\s,]*(.*)$/ },
        { prefix: 'Walaikum salam', regex: /^salam(?:\s+aleykoum)?\b[\s,]*(.*)$/ }
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
 
// =====================================================================
// INTENTIONS (triees par priorite decroissante)
// =====================================================================
const INTENTS = [
  {
    name: 'vol_annule_retarde', priority: 130, handoff: true,
    tests: [
      /\bvol annule\b/, /\bvol retarde\b/, /\bmon vol (?:a ete |est )?annule\b/,
      /\bmon vol (?:a ete |est )?retarde\b/, /\bflight cancel(?:l)?ed\b/,
      /\bmy flight (?:was |is )?cancel(?:l)?ed\b/, /\bflight delay(?:ed)?\b/,
      /\bmy flight (?:is |was )?delayed\b/
    ],
    response: {
      fr: "Nous sommes désolés pour la gêne occasionnée. Merci d'indiquer votre référence de dossier, votre numéro de téléphone et le nom du passager : un conseiller prendra votre demande dès que possible.",
      en: "We are sorry for the inconvenience. Please provide your booking reference, your phone number and the passenger's name; an advisor will assist you as soon as possible."
    }
  },
  {
    name: 'confirmation_vol', priority: 125, handoff: true,
    tests: [
      /\bstatut de mon vol\b/, /\best ce que mon vol est confirme\b/, /\bmon vol est confirme\b/,
      /\bmon vol confirme\b/, /\bflight status\b/, /\bis my flight confirmed\b/,
      /\bmy flight confirmation\b/, /\bmy booking confirmed\b/
    ],
    response: {
      fr: "Merci de nous envoyer la référence de votre billet, le numéro de billet, votre facture ou la copie du passeport du passager. Un conseiller AMI Voyages prendra ensuite le relais. Vous pouvez aussi consulter le site de la compagnie aérienne : quelle compagnie est-ce ?",
      en: "Please send us your ticket reference, ticket number, invoice or a copy of the passenger's passport. An AMI Voyages advisor will then assist you. You can also check the airline's website. Which airline is your flight with?"
    }
  },
  {
    name: 'annulation_billet', priority: 120, handoff: true,
    tests: [
      /\bannuler mon billet\b/, /\bje veux annuler\b/, /\bannulation\b/, /\banulasion\b/, /\bannuller\b/,
      /\bcancel my ticket\b/, /\bcancel my booking\b/, /\bi want to cancel\b/, /\bcancell?ation\b/,
      /\bcancell\b/
    ],
    response: {
      fr: "Les conditions d'annulation dépendent du billet réservé, de la compagnie aérienne et des règles tarifaires. Si vous avez déjà un dossier, merci de nous communiquer votre référence et le nom du passager. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Cancellation conditions depend on the booked ticket, the airline and the fare rules. If you already have a booking, please send us your reference and the passenger's name. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'modification_billet', priority: 118, handoff: true,
    tests: [
      /\bmodifier mon billet\b/, /\bmodifier mon vol\b/, /\bchanger mon vol\b/, /\bchanger la date\b/,
      /\bchangement de date\b/, /\bmodif\b/, /\bchnage\b/, /\bmodify my (?:ticket|flight|booking)\b/,
      /\bchange my (?:ticket|flight|booking|date)\b/, /\bi want to change my flight\b/,
      /\bchange flight date\b/, /\bdate change\b/
    ],
    response: {
      fr: "Une modification doit être vérifiée par un conseiller selon les conditions du billet. Merci d'indiquer votre référence de dossier ainsi que votre demande précise. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "A change needs to be checked by an advisor based on the ticket conditions. Please provide your booking reference and your specific request. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'verification_dossier', priority: 115, handoff: true,
    tests: [
      /\bverifier mon dossier\b/, /\bverification de dossier\b/, /\bstatut de mon dossier\b/,
      /\bcheck my booking\b/, /\bverify my booking\b/, /\bbooking status\b/, /\bcan you check my booking\b/
    ],
    response: {
      fr: "Oui, un conseiller peut vérifier votre dossier. Merci d'indiquer votre référence de dossier ainsi que le nom du passager. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Yes, an advisor can check your booking. Please provide your booking reference and the passenger's name. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'prix_disponibilite', priority: 110, handoff: true,
    tests: [
      /\bprix\b/, /\btarif\b/, /\btarf\b/, /\bpri\b/, /\bcombien\b/, /\bcombient\b/, /\bcbien\b/,
      /\bcmbien\b/, /\bc est combien\b/, /\bca coute combien\b/, /\bdisponible\b/,
      /\bdisponibilite\b/, /\bdispo\b/, /\bvous avez dispo\b/, /\bavez vous des places\b/,
      /\bplaces disponibles\b/, /\bprice\b/, /\bprices\b/, /\bfare\b/, /\bfares\b/, /\bhow much\b/,
      /\bcost\b/, /\bavailable\b/, /\bavailability\b/, /\bavailible\b/, /\bany availability\b/,
      /\bseats available\b/
    ],
    response: {
      fr: "Les prix varient selon la destination, la date, la compagnie aérienne et les places disponibles. Merci de nous indiquer : votre destination, votre ville de départ et de retour, vos dates de départ et de retour, le nombre de passagers, et votre préférence éventuelle (compagnie aérienne, vol direct ou prix le plus bas). Un conseiller AMI Voyages vous assistera ensuite.",
      en: "Prices vary depending on the destination, date, airline and seat availability. Please let us know: your destination, your departure and return city, your departure and return dates, the number of passengers, and your preference if any (airline, direct flight or lowest price). An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'devis', priority: 108, handoff: true,
    tests: [
      /\bdevis\b/, /\bje veux un devis\b/, /\bbesoin de devis\b/, /\bquote\b/, /\bi want a quote\b/,
      /\bi need a quote\b/, /\bcan i get a quote\b/
    ],
    response: {
      fr: "Oui, nous pouvons transmettre votre demande à un conseiller. Merci d'indiquer : votre destination, votre ville de départ et de retour, vos dates, le nombre de passagers, et votre numéro de téléphone. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Yes, we can forward your request to an advisor. Please provide: your destination, your departure and return city, your dates, the number of passengers, and your phone number. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'paiement_conditions', priority: 106, handoff: true,
    tests: [
      /\bmoyens de paiement\b/, /\bconditions de paiement\b/, /\bmodalites? de paiement\b/,
      /\bcomment payer\b/, /\bpayment method\b/, /\bpayment options?\b/, /\bhow do i pay\b/,
      /\bhow can i pay\b/
    ],
    response: {
      fr: "Nous acceptons les virements bancaires, les espèces, les chèques ANCV ainsi que les chèques-vacances / Connect. Nous pouvons aussi vous envoyer un lien de paiement en ligne. Selon le dossier, un paiement en plusieurs fois peut être possible, sous condition.",
      en: "We accept bank transfers, cash, ANCV vouchers as well as holiday vouchers / Connect. We can also send you an online payment link. Depending on the booking, payment in installments may be possible, under certain conditions."
    }
  },
  {
    name: 'lien_paiement', priority: 105, handoff: true,
    tests: [
      /\blien de paiement\b/, /\benvoyer (?:un |le )?lien de paiement\b/, /\bpayment link\b/,
      /\bsend (?:me )?(?:a |the )?payment link\b/
    ],
    response: {
      fr: "Merci de nous envoyer votre facture d'achat, ou à défaut la copie du passeport du passager. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Please send us your invoice, or failing that, a copy of the passenger's passport. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'paiement_distance', priority: 104, handoff: true,
    tests: [
      /\bpaiement a distance\b/, /\bpaiement en ligne\b/, /\btelepaiement\b/, /\bonline payment\b/,
      /\bremote payment\b/, /\bpay online\b/, /\bpay remotely\b/
    ],
    response: {
      fr: "Selon le dossier, un paiement à distance est possible par carte bancaire via un lien de paiement sécurisé. Merci de nous envoyer votre facture d'achat, ou à défaut la copie du passeport du passager. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Depending on the booking, remote payment by card via a secure payment link is possible. Please send us your invoice, or failing that, a copy of the passenger's passport. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'visa', priority: 102, handoff: true,
    tests: [
      /\bvisa\b/, /\bviza\b/, /\bdemande de visa\b/, /\bvisa pour\b/, /\bvisa application\b/,
      /\bvisa for\b/, /\bvisa info\b/, /\bneed visa information\b/
    ],
    response: {
      fr: "Oui, nous proposons une assistance visa pour certaines destinations uniquement. Indiquez-nous votre destination et votre nationalité afin de vérifier si nous pouvons vous aider. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Yes, we offer visa assistance for certain destinations only. Please tell us your destination and your nationality so we can check if we can help. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'documents_voyage', priority: 100, handoff: true,
    tests: [
      /\bdocuments? pour voyager\b/, /\bdocuments? requis\b/, /\bquels? documents\b/,
      /\bquels? papiers\b/, /\btravel documents\b/, /\brequired documents\b/, /\bwhat documents\b/
    ],
    response: {
      fr: "Les documents nécessaires dépendent de la destination, de votre nationalité et du type de voyage. Indiquez-nous votre destination et votre nationalité afin que nous puissions vous orienter. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Required documents depend on the destination, your nationality and the type of trip. Please tell us your destination and your nationality so we can guide you. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'passeport', priority: 98, handoff: true,
    tests: [
      /\bpasseport\b/, /\bpasport\b/, /\bpassport\b/, /\bmon passeport\b/, /\bpassport valid\b/,
      /\bis my passport valid\b/, /\bpassport validity\b/
    ],
    response: {
      fr: "La durée de validité requise pour le passeport dépend de la destination (souvent 6 mois après la date de retour). Indiquez-nous votre destination et la date d'expiration de votre passeport afin que nous puissions vérifier. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "The required passport validity depends on the destination (often 6 months after the return date). Please tell us your destination and your passport's expiry date so we can check. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'omra_hajj', priority: 96, handoff: true,
    tests: [/\bomra\b/, /\bhajj\b/, /\bumrah\b/, /\bomra et hajj\b/],
    response: {
      fr: "Oui, nous pouvons vous accompagner pour les voyages omra et hajj selon la période et les disponibilités. Si vous souhaitez connaître les tarifs, merci de nous indiquer : votre destination, votre ville de départ et de retour, vos dates, le nombre de passagers. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Yes, we can assist you with Umrah and Hajj trips depending on the period and availability. If you'd like to know the prices, please tell us: your destination, your departure and return city, your dates, the number of passengers. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'grossesse', priority: 95, handoff: true,
    tests: [/\bfemme enceinte\b/, /\benceinte\b/, /\bgrossesse\b/, /\bpregnant\b/, /\bpregnancy\b/],
    response: {
      fr: "Les femmes enceintes peuvent généralement voyager jusqu'à 6 mois. Au-delà, une autorisation médicale est requise, sous réserve d'acceptation par la compagnie aérienne et les services aéroportuaires. Vous pouvez également consulter votre médecin.",
      en: "Pregnant women can generally travel up to 6 months. Beyond that, a medical authorization is required, subject to acceptance by the airline and airport services. You can also check with your doctor."
    }
  },
  {
    name: 'bebe_tarif', priority: 94, handoff: true,
    tests: [/\bbebe tarif\b/, /\btarif bebe\b/, /\btarif (?:pour )?(?:un )?bebe\b/, /\bbaby fare\b/, /\bbaby price\b/],
    response: {
      fr: "De 1 jour à moins de 2 ans, le passager est considéré dans la catégorie bébé et paie généralement les taxes aéroport, selon les conditions du billet. De 2 ans à moins de 12 ans, il est considéré comme enfant. À partir de 12 ans, il est considéré comme adulte.",
      en: "From 1 day old to under 2 years, the passenger is considered a baby and generally pays airport taxes, depending on the ticket conditions. From 2 years to under 12 years, they are considered a child. From 12 years old, they are considered an adult."
    }
  },
  {
    name: 'bebe_bagage', priority: 93, handoff: true,
    tests: [/\bbebe bagage\b/, /\bbagage bebe\b/, /\bbagage (?:pour |de )?bebe\b/, /\bbaby baggage\b/, /\bbaby luggage\b/],
    response: {
      fr: "Oui, en général, les bébés ont droit aux bagages, mais cela dépend de la compagnie aérienne. Sauf chez Saudia Airlines, où c'est 23 kilos.",
      en: "Yes, generally babies are entitled to baggage, but this depends on the airline. Except for Saudia Airlines, where it's 23 kilos."
    }
  },
  {
    name: 'enfant_bagage', priority: 92, handoff: true,
    tests: [/\benfant bagage\b/, /\bbagage enfant\b/, /\bbagage pour enfant\b/, /\bchild baggage\b/, /\bchild luggage\b/],
    response: {
      fr: "Les bagages pour les enfants suivent généralement les mêmes normes que pour les adultes, mais cela peut dépendre de la compagnie aérienne.",
      en: "Baggage for children generally follows the same rules as for adults, but this may depend on the airline."
    }
  },
  {
    name: 'demande_humain', priority: 90, handoff: true,
    tests: [
      /\bun agent\b/, /\bun conseiller\b/, /\bhumain\b/, /\bservice client\b/,
      /\bparler a un agent\b/, /\bparler a un conseiller\b/, /\bparler a quelqu un\b/,
      /\bhuman\b/, /\bcustomer service\b/, /\bspeak to (?:a |an )?(?:agent|human|person)\b/,
      /\btalk to (?:a |an )?(?:agent|human|person)\b/, /\breal person\b/
    ],
    response: {
      fr: "Bien sûr. Merci de nous indiquer votre nom, votre numéro de téléphone et l'objet de votre demande. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Of course. Please provide your name, your phone number and the subject of your request. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'rappel_client', priority: 88, handoff: true,
    tests: [
      /\bappelez moi\b/, /\bappel moi\b/, /\bme rappeler\b/, /\bpouvez vous me rappeler\b/,
      /\bdemande de rappel\b/, /\bcall me\b/, /\bcall me back\b/, /\bcan you call me\b/
    ],
    response: {
      fr: "Oui, nous pouvons transmettre votre demande à un conseiller. Merci d'indiquer votre nom et le sujet de votre demande. Un conseiller AMI Voyages prendra le relais.",
      en: "Yes, we can forward your request to an advisor. Please provide your name and the subject of your request. An AMI Voyages advisor will take over."
    }
  },
  {
    name: 'projet_voyage', priority: 85, handoff: true,
    tests: [
      /\bje veux (?:aller|voyager|partir)\b/, /\bj aimerais (?:aller|voyager|partir)\b/,
      /\bje voudrais (?:aller|voyager|partir)\b/, /\bje souhaite (?:aller|voyager|partir)\b/,
      /\bbil(?:l)?et\s+p(?:ou)?r\b/, /\bvol\s+p(?:ou)?r\b/, /\bje pars\b/,
      /\bpartir\s+(?:p(?:ou)?r|en|a|au|aux|vers)\b/, /\bvoyager\s+(?:p(?:ou)?r|en|a|au|aux|vers)\b/,
      /\baller (?:au|aux|en|a)\b/, /\bi want (?:a |to )?ticket\b/, /\bi want to (?:go|travel|fly)\b/,
      /\bi need a ticket\b/, /\bticket to\b/, /\btravel to\b/, /\bflight to\b/,
      /\bi d like to (?:go|travel|fly)\b/
    ],
    response: {
      fr: "Nous pouvons vous aider à organiser votre voyage. Merci de nous indiquer votre destination, votre ville de départ, vos dates de départ et de retour, et le nombre de passagers. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "We can help you organize your trip. Please tell us your destination, departure city, departure and return dates, and the number of passengers. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'horaires_ouverture', priority: 80, handoff: false,
    tests: [
      /\bhoraire\b/, /\bhoraires\b/, /\bheur\b/, /\bheures d ouverture\b/, /\bvos horaires\b/,
      /\bquels sont vos horaires\b/, /\bc quoi vos horaires\b/, /\bvous etes ouvert\b/,
      /\bvous ouvrez\b/, /\bvous fermez\b/, /\bouvert aujourd hui\b/, /\bouvert demain\b/,
      /\bopening hours\b/, /\bwhat time (?:do you )?open\b/, /\bwhat time (?:do you )?close\b/,
      /\bare you open\b/, /\bopen today\b/, /\bopen tomorrow\b/, /\bbusiness hours\b/
    ],
    response: {
      fr: "Nos horaires sont les suivants : AMI Voyages Paris Gare du Nord, 157 rue Lafayette, 75010 Paris, ouvert du lundi au samedi de 10h00 à 18h30. AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République, 93300 Aubervilliers, ouvert du mardi au vendredi de 10h00 à 18h30. Vous pouvez aussi nous écrire ici sur WhatsApp.",
      en: "Our opening hours are as follows: AMI Voyages Paris Gare du Nord, 157 rue Lafayette, 75010 Paris, open Monday to Saturday from 10:00am to 6:30pm. AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République, 93300 Aubervilliers, open Tuesday to Friday from 10:00am to 6:30pm. You can also write to us here on WhatsApp."
    }
  },
  {
    name: 'localisation_agences', priority: 75, handoff: false,
    tests: [
      /\badresse\b/, /\badress\b/, /\bou (?:etes|es) vous\b/, /\bou se trouve votre agence\b/,
      /\bou vous etes\b/, /\blocalisation\b/, /\bwhere are you\b/, /\blocation\b/,
      /\baddress\b/, /\boffice address\b/, /\bwhere is your office\b/
    ],
    response: {
      fr: "Voici nos agences : AMI Voyages Paris Gare du Nord, 157 rue Lafayette, 75010 Paris, ouvert du lundi au samedi de 10h00 à 18h30. AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République, 93300 Aubervilliers, ouvert du mardi au vendredi de 10h00 à 18h30. Vous pouvez aussi nous écrire ici sur WhatsApp.",
      en: "Here are our branches: AMI Voyages Paris Gare du Nord, 157 rue Lafayette, 75010 Paris, open Monday to Saturday from 10:00am to 6:30pm. AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République, 93300 Aubervilliers, open Tuesday to Friday from 10:00am to 6:30pm. You can also write to us here on WhatsApp."
    }
  },
  {
    name: 'destination_couverte', priority: 70, handoff: false,
    tests: [
      /\bbangladesh\b/, /\binde\b/, /\bindia\b/, /\bsri lanka\b/, /\bmali\b/, /\bsenegal\b/,
      /\bguinee\b/, /\bguinea\b/, /\brdc\b/, /\bdr congo\b/, /\bdrc\b/, /\bdhaka\b/, /\bdakar\b/
    ],
    response: {
      fr: "Oui, nous travaillons sur cette destination. Merci de nous indiquer : votre ville de départ et de retour, vos dates de départ et de retour, le nombre de passagers, et votre préférence éventuelle (compagnie aérienne, vol direct ou prix le plus bas). Un agent vous indiquera le meilleur prix actuel.",
      en: "Yes, we work on this destination. Please tell us: your departure and return city, your departure and return dates, the number of passengers, and your preference if any (airline, direct flight or lowest price). An agent will give you the best current price."
    }
  },
  {
    name: 'promos', priority: 65, handoff: false,
    tests: [
      /\bpromo\b/, /\bpromos\b/, /\boffre speciale\b/, /\boffres speciales\b/, /\blisbonne dhaka\b/,
      /\bspecial offer\b/, /\bdiscount\b/, /\bpromotion\b/
    ],
    response: {
      fr: "Oui, nous pouvons proposer des tarifs avantageux au départ de la France avec retour en France, ainsi que sur Lisbonne-Dhaka. Les meilleurs tarifs sont en général hors vacances et hors week-end. Si vous souhaitez connaître les tarifs, merci de nous indiquer votre destination, vos villes de départ et de retour, vos dates, et le nombre de passagers. Un agent vous indiquera le meilleur prix actuel.",
      en: "Yes, we can offer good rates departing from France with return to France, as well as on Lisbon-Dhaka. The best rates are usually outside holidays and weekends. If you'd like to know the prices, please tell us your destination, your departure and return city, your dates, and the number of passengers. An agent will give you the best current price."
    }
  },
  {
    name: 'bus', priority: 60, handoff: false,
    tests: [/\bbus\b/, /\btrain\b/, /\bfaites vous (?:le )?bus\b/, /\bdo you (?:offer|have) bus\b/, /\bbus or train\b/],
    response: {
      fr: "Non, nous proposons uniquement des voyages aériens. Notre agence est spécialisée dans les destinations d'Asie du Sud, comme le Bangladesh, l'Inde et le Sri Lanka, ainsi que d'Afrique subsaharienne, comme le Mali, le Sénégal, la Guinée ou la RDC.",
      en: "No, we only offer air travel. Our agency specializes in South Asian destinations such as Bangladesh, India and Sri Lanka, as well as sub-Saharan African destinations such as Mali, Senegal, Guinea or the DRC."
    }
  },
  {
    name: 'appel_non_repondu', priority: 58, handoff: false,
    tests: [
      /\bvous ne repondez pas\b/, /\bje n arrive pas a vous joindre\b/, /\bligne(?:s)? (?:est |sont )?occupe/,
      /\bje vous ai appele\b/, /\bappel manque\b/, /\bpersonne ne repond\b/, /\bca repond pas\b/,
      /\byou don t answer\b/, /\bi can t reach you\b/, /\bmissed call\b/, /\bno (?:one|body) (?:is )?answering\b/
    ],
    response: {
      fr: "Nous sommes désolés si vous n'avez pas reçu de réponse rapide. Pouvez-vous nous préciser votre demande ou nous laisser votre numéro ? Un conseiller AMI Voyages vous reviendra dès que possible.",
      en: "We are sorry if you haven't received a quick response. Could you clarify your request or leave us your number? An AMI Voyages advisor will get back to you as soon as possible."
    }
  },
  {
    name: 'agent_disponible', priority: 56, handoff: false,
    tests: [/\bagent disponible\b/, /\bconseiller disponible\b/, /\best quelqu un disponible\b/, /\bagent available\b/, /\bis (?:someone|anyone) available\b/],
    response: {
      fr: "Tous nos agents sont disponibles selon leur planning. Nous faisons de notre mieux pour répondre dans les meilleurs délais pendant les horaires d'ouverture. En dehors de ces horaires, vous pouvez déjà nous laisser votre demande ici sur WhatsApp.",
      en: "All our agents are available according to their schedule. We do our best to respond as quickly as possible during opening hours. Outside these hours, you can already leave your request here on WhatsApp."
    }
  },
  {
    name: 'delai_reponse', priority: 54, handoff: false,
    tests: [/\bdelai de reponse\b/, /\bcombien de temps pour repondre\b/, /\ben combien de temps\b/, /\bresponse time\b/, /\bhow long to respond\b/],
    response: {
      fr: "Nous faisons de notre mieux pour répondre dans les meilleurs délais pendant les horaires d'ouverture. En dehors de ces horaires, vous pouvez déjà nous laisser votre demande ici sur WhatsApp.",
      en: "We do our best to respond as quickly as possible during opening hours. Outside these hours, you can already leave your request here on WhatsApp."
    }
  },
  {
    name: 'duree_minimum', priority: 50, handoff: false,
    tests: [/\bduree minimum\b/, /\bminimum de jours\b/, /\bsejour minimum\b/, /\bminimum stay\b/, /\bminimum days\b/],
    response: {
      fr: "En Asie, c'est généralement 5 à 7 jours. En Afrique, c'est généralement 3 jours, selon la compagnie aérienne.",
      en: "In Asia, it's generally 5 to 7 days. In Africa, it's generally 3 days, depending on the airline."
    }
  },
  {
    name: 'remerciement', priority: 45, handoff: false,
    tests: [/\bmerci\b/, /\bmercii\b/, /\bmercie\b/, /\bmrc\b/, /\bmrc bcp\b/, /\bthank you\b/, /\bthanks\b/, /\bthx\b/, /\bty\b/],
    response: {
      fr: "Avec plaisir. Je reste à votre disposition pour votre voyage.",
      en: "You're welcome. I remain available to help with your trip."
    }
  },
  {
    name: 'ca_va', priority: 43, handoff: false,
    tests: [
      /\bca va\b/, /\bsa va\b/, /\bcava\b/, /\bcomment ca va\b/, /\bcomment allez vous\b/,
      /\bcomment vas tu\b/, /\bquoi de neuf\b/, /\bhow are you\b/, /\bhows it going\b/,
      /\bhow are u\b/, /\bhow r u\b/
    ],
    response: {
      fr: "Oui, ça va très bien, et vous ? Bienvenue chez AMI Voyages. Nous sommes une agence de voyages spécialisée dans les vols vers l'Asie du Sud et l'Afrique subsaharienne. En quoi puis-je vous aider ? Si vous souhaitez connaître les tarifs, merci de nous indiquer votre destination, vos villes de départ et de retour, vos dates, et le nombre de passagers.",
      en: "I'm doing very well, thank you, and you? Welcome to AMI Voyages. We are a travel agency specializing in flights to South Asia and sub-Saharan Africa. How can I help you? If you'd like to know the prices, please tell us your destination, your departure and return city, your dates, and the number of passengers."
    }
  },
  {
    name: 'salutation', priority: 41, handoff: false,
    tests: [/\bbonjour\b/, /\bsalut\b/, /\bcoucou\b/, /\bbonsoir\b/, /\bhello\b/, /\bhi\b/, /\bhey\b/, /\bgood morning\b/, /\bgood afternoon\b/, /\bgood evening\b/],
    response: {
      fr: "Bonjour, bienvenue chez AMI Voyages. Nous sommes une agence de voyages spécialisée dans les vols vers l'Asie du Sud et l'Afrique subsaharienne. En quoi puis-je vous aider ? Si vous souhaitez connaître les tarifs, merci de nous indiquer votre destination, vos villes de départ et de retour, vos dates, et le nombre de passagers.",
      en: "Hello, welcome to AMI Voyages. We are a travel agency specializing in flights to South Asia and sub-Saharan Africa. How can I help you? If you'd like to know the prices, please tell us your destination, your departure and return city, your dates, and the number of passengers."
    }
  },
  {
    name: 'salam', priority: 40, handoff: false,
    tests: [/\bsalam\b/, /\bsalam aleykoum\b/, /\bsalamalaykoum\b/, /\bsalamaleykoum\b/, /\bassalamoualaykoum\b/, /\bassalamualaikum\b/],
    response: {
      fr: "Walaikum salam, bienvenue chez AMI Voyages. Nous sommes une agence de voyages spécialisée dans les vols vers l'Asie du Sud et l'Afrique subsaharienne. En quoi puis-je vous aider ? Si vous souhaitez connaître les tarifs, merci de nous indiquer votre destination, vos villes de départ et de retour, vos dates, et le nombre de passagers.",
      en: "Walaikum salam, welcome to AMI Voyages. We are a travel agency specializing in flights to South Asia and sub-Saharan Africa. How can I help you? If you'd like to know the prices, please tell us your destination, your departure and return city, your dates, and the number of passengers."
    }
  },
  {
    name: 'au_revoir', priority: 38, handoff: false,
    tests: [/\bau revoir\b/, /\ba bientot\b/, /\bbonne journee\b/, /\bbonne soiree\b/, /\ba plus\b/, /\bbye\b/, /\bgoodbye\b/, /\bsee you\b/, /\bsee ya\b/, /\bcya\b/],
    response: {
      fr: "Merci pour votre message. À bientôt chez AMI Voyages.",
      en: "Thank you for your message. See you soon at AMI Voyages."
    }
  }
].sort((a, b) => b.priority - a.priority);
 
function detectIntent(message = '') {
  const normalizedMessage = normalizeText(message);
  for (const intent of INTENTS) {
    try {
      if (intent.tests.some((regex) => regex.test(normalizedMessage))) {
        return intent;
      }
    } catch (e) {
      // ignorer les erreurs d'expression reguliere
    }
  }
  return null;
}
 
// =====================================================================
// GENERATION DE LA REPONSE
// =====================================================================
async function generateTravelReply(messageText, sender) {
  const safeText = String(messageText || '').trim();
  if (!safeText) return t(detectLanguage(safeText), 'empty_message');
 
  const lang = detectLanguage(safeText);
  const { greeting, rest, isOnlyGreeting } = parseLeadingGreeting(safeText, lang);
  const cleanText = rest || safeText;
 
  if (isOnlyGreeting) {
    const intent = detectIntent(cleanText);
    const responseText = intent ? (typeof intent.response === 'object' ? intent.response[lang] : intent.response) : t(lang, 'empty_message');
    return prefixResponse(greeting, responseText);
  }
 
  if (sender) {
    const session = getSession(sender);
    if (session.awaitingContact && looksLikeContactInfo(cleanText)) {
      clearSession(sender);
      return t(lang, 'handoff_ack');
    }
  }
 
  const intent = detectIntent(cleanText);
  if (intent) {
    if (intent.name === 'projet_voyage') {
      const destination = extractTravelDestination(cleanText);
      if (destination) {
        const msg = lang === 'en'
          ? `Great, we can help you organize your trip to ${destination}. Please tell us your departure city, your departure and return dates, and the number of passengers. An AMI Voyages advisor will then assist you.`
          : `Super, nous pouvons vous aider à organiser votre voyage vers ${destination}. Merci de nous indiquer votre ville de départ, vos dates de départ et de retour, et le nombre de passagers. Un conseiller AMI Voyages prendra ensuite le relais.`;
        return prefixResponse(greeting, msg);
      }
    }
    if (intent.handoff && sender) {
      saveSession(sender, { awaitingContact: true, intent: intent.name, timestamp: Date.now(), lang });
    }
    const responseText = typeof intent.response === 'object' ? intent.response[lang] : intent.response;
    return prefixResponse(greeting, responseText);
  }
 
  return prefixResponse(greeting, t(lang, 'unknown_message'));
}
 
async function handleTextMessage(text, sender) {
  return await generateTravelReply(text, sender);
}
 
// =====================================================================
// AUDIO (transcription a brancher sur un vrai service plus tard)
// =====================================================================
async function transcribeAudio(filePath) {
  try {
    // TODO: integrer un vrai service de transcription (ex: API Whisper)
    return '[transcription indisponible]';
  } catch (e) {
    return '';
  }
}
 
async function downloadFile(url, destPath) {
  const writer = fs.createWriteStream(destPath);
  const response = await axios.get(url, {
    responseType: 'stream',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }
  });
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
    if (!mediaId) return t('fr', 'unsupported_media');
 
    const mediaUrlResp = await axios.get(`https://graph.facebook.com/v17.0/${mediaId}`, {
      params: { access_token: process.env.WHATSAPP_TOKEN }
    });
    const mediaUrl = mediaUrlResp.data?.url;
    if (!mediaUrl) return t('fr', 'unsupported_media');
 
    const tmpPath = `./tmp_${Date.now()}.ogg`;
    await downloadFile(mediaUrl, tmpPath);
    const transcription = await transcribeAudio(tmpPath);
    try { await fs.promises.unlink(tmpPath); } catch (e) { /* ignore */ }
 
    const lang = detectLanguage(transcription);
    if (!transcription) return t(lang, 'no_transcription');
    return await generateTravelReply(transcription, sender);
  } catch (e) {
    console.warn('[AUDIO] erreur:', e.message || e);
    return t('fr', 'audio_error');
  }
}
 
function sanitizeResponse(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}
 
async function sendWhatsAppText(to, body) {
  const url = `https://graph.facebook.com/v17.0/${process.env.PHONE_NUMBER_ID}/messages`;
  const text = sanitizeResponse(body);
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
    console.log('[WHATSAPP] Message envoye, id:', response.data.messages?.[0]?.id || 'aucun id');
  } catch (error) {
    console.error("[WHATSAPP] Erreur d'envoi du message :", error.response?.data || error.message || error);
    throw error;
  }
}
 
// =====================================================================
// ROUTES
// =====================================================================
app.get('/', (req, res) => {
  res.send("Le chatbot WhatIA (AMI Voyages) est en cours d'execution");
});
 
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});
 
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
 
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(String(challenge));
  }
  return res.status(403).send('Echec de la verification du webhook');
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
      return res.status(200).send('Ignore : evenement non-WhatsApp');
    }
 
    const value = body.entry[0].changes[0].value;
    const messages = value.messages || [];
    if (!messages.length) {
      return res.status(200).send('Aucun message');
    }
 
    const message = messages[0];
    const messageId = message?.id || message?.message?.id || message?.message_id || null;
    if (messageId && isMessageProcessed(messageId)) {
      console.log('[WEBHOOK] message en double ignore', messageId);
      return res.status(200).send('Message en double ignore');
    }
    markMessageProcessed(messageId);
 
    const sender = message.from;
    let replyText = '';
 
    if (message.type === 'text' && message.text?.body) {
      replyText = await handleTextMessage(message.text.body, sender);
    } else if (['audio', 'voice'].includes(message.type)) {
      replyText = await handleAudioMessage(message, sender);
    } else if (['sticker', 'image', 'video', 'document', 'location', 'contacts'].includes(message.type)) {
      replyText = t('fr', 'unsupported_media');
    } else {
      replyText = t('fr', 'unknown_message');
    }
 
    await sendWhatsAppText(sender, replyText);
    res.status(200).send('OK');
  } catch (error) {
    console.error('[WEBHOOK] Erreur de traitement', error);
    res.status(500).send('Erreur serveur');
  }
});
 
app.listen(PORT, () => {
  console.log(`Serveur WhatIA en cours d'execution sur le port ${PORT}`);
});