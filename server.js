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
function normalizeText(text) {
  let s = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s\u0980-\u09FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
 
  const greetingFixes = {
    bjr: 'bonjour', bnjr: 'bonjour', bjrr: 'bonjour',
    bonjor: 'bonjour', bonjou: 'bonjour',
    slt: 'salut',
    slm: 'salam',
    salamalaykoum: 'salam aleykoum', salamaleykoum: 'salam aleykoum',
    salamalaikoum: 'salam aleykoum', assalamoualaykoum: 'salam aleykoum',
    assalamoualaikoum: 'salam aleykoum', assalamualaikum: 'salam aleykoum',
    assalamualaykum: 'salam aleykoum', asalamualaikum: 'salam aleykoum'
  };
 
  s = s.split(' ').map((w) => greetingFixes[w] || w).join(' ');
  return s;
}
 
// =====================================================================
// DETECTION DE LANGUE  FR / EN / BN
// =====================================================================
// Vérifie si le texte contient du script bengali (Unicode U+0980–U+09FF)
function hasBengaliScript(text) {
  return /[\u0980-\u09FF]/.test(String(text || ''));
}
 
// Mots Banglish fréquents (bengali en translittération latine)
const BANGLISH_WORDS = new Set([
  'ami', 'amar', 'amra', 'apni', 'apnar', 'ache', 'ase', 'ace', 'chai', 'chay',
  'lagbe', 'lagbey', 'jabo', 'zabo', 'jete', 'kotha', 'kothay', 'koto', 'coto',
  'kotho', 'taka', 'kobe', 'kokhon', 'khola', 'bolbo', 'bolte', 'bolun', 'korun',
  'diben', 'pathan', 'pathao',
  // termes metier banglish (sans les noms de villes et mots ambigus)
  'jamate', 'tiket', 'biket', 'biza', 'peyment', 'buking', 'aijent',
  'shathe', 'sathe', 'niyom', 'shomoy', 'somoy', 'manush', 'manus',
  'hoye', 'hoyeche', 'giyeche', 'geche', 'thakbe', 'ki', 'kta', 'den',
  'lagbey', 'lage', 'daam', 'khaber', 'shomossa', 'jiggesh'
]);
 
const FRENCH_LANG_WORDS = new Set([
  'bonjour', 'salut', 'bonsoir', 'coucou', 'merci', 'svp', 'stp', 'plait',
  'besoin', 'veux', 'voudrais', 'aimerais', 'souhaite', 'comment', 'quoi',
  'quand', 'pourquoi', 'combien', 'combient', 'cbien', 'cmbien', 'oui', 'non',
  'vol', 'billet', 'bilet', 'voyage', 'voyager', 'destination', 'disponible',
  'disponibilite', 'dispo', 'confirmer', 'confirme', 'confirmation', 'annuler',
  'annulation', 'modifier', 'modif', 'changer', 'changement', 'informations',
  'telephone', 'numero', 'paiement', 'payer', 'passeport', 'documents', 'bebe',
  'enceinte', 'grossesse', 'bagage', 'agence', 'horaires', 'horaire', 'heur',
  'adresse', 'conseiller', 'humain', 'rappel', 'devis', 'depart', 'retour',
  'passager', 'jveux', 'jveu', 'puis', 'pouvez', 'etes', 'tres', 'bien',
  'tarif', 'tarf', 'prix', 'agent'
]);
 
const ENGLISH_LANG_WORDS = new Set([
  'hello', 'hi', 'hey', 'please', 'pls', 'thanks', 'thank', 'thx', 'ty',
  'need', 'want', 'would', 'like', 'much', 'yes', 'no', 'flight', 'ticket',
  'tickets', 'travel', 'available', 'availability', 'availible', 'confirm',
  'confirmed', 'confirmation', 'cancel', 'canceled', 'cancelled', 'cancellation',
  'modify', 'change', 'information', 'contact', 'phone', 'number', 'reference',
  'payment', 'pay', 'passport', 'documents', 'document', 'baby', 'pregnant',
  'pregnancy', 'luggage', 'baggage', 'departure', 'passenger', 'passengers',
  'quote', 'human', 'customer', 'service', 'call', 'back', 'hours', 'opening',
  'address', 'office', 'price', 'prices', 'fare', 'fares', 'booking', 'check',
  'send', 'valid', 'where', 'what', 'when', 'how', 'any', 'can', 'you', 'your',
  'my', 'me', 'visa', 'seat', 'seats'
]);
 
function detectLanguage(text = '') {
  const raw = String(text || '');
 
  // Priorité 1 : script bengali présent → BN
  if (hasBengaliScript(raw)) return 'bn';
 
  const normalized = normalizeText(raw);
  const words = normalized.split(' ').filter(Boolean);
 
  let frCount = 0;
  let enCount = 0;
  let bnCount = 0;
 
  for (const w of words) {
    if (BANGLISH_WORDS.has(w)) bnCount++;
    if (FRENCH_LANG_WORDS.has(w)) frCount++;
    if (ENGLISH_LANG_WORDS.has(w)) enCount++;
  }
 
  const max = Math.max(frCount, enCount, bnCount);
  if (max === 0) return 'fr';
  if (bnCount === max) return 'bn';
  if (enCount === max) return 'en';
  return 'fr';
}
 
// =====================================================================
// TEXTES SYSTEME TRILINGUES
// =====================================================================
const TEXTS = {
  fr: {
    unsupported_media: "Désolé, je ne peux pas traiter ce type de fichier pour le moment. Vous pouvez me décrire votre demande par écrit.",
    handoff_ack: "Merci pour ces informations. Un conseiller AMI Voyages va prendre en charge votre dossier et vous recontactera très prochainement.",
    no_transcription: "Je n'ai pas réussi à comprendre votre message vocal. Pourriez-vous le réécrire en texte, s'il vous plaît ?",
    audio_error: "Une erreur est survenue pendant le traitement de votre message vocal. Un conseiller pourra vous aider si besoin.",
    empty_message: "Je suis à votre écoute. Pourriez-vous préciser votre demande ?",
    unknown_message: "Je n'ai pas tout à fait compris votre demande. Un conseiller AMI Voyages va prendre le relais pour vous aider."
  },
  en: {
    unsupported_media: "Sorry, I can't process this type of file right now. Feel free to describe your request in writing.",
    handoff_ack: "Thank you for this information. An AMI Voyages advisor will take over your file and get back to you very soon.",
    no_transcription: "I couldn't understand your voice message. Could you please write it as text instead?",
    audio_error: "Something went wrong while processing your voice message. An advisor can help if needed.",
    empty_message: "I'm listening. Could you tell me more about what you need?",
    unknown_message: "I didn't quite understand your request. An AMI Voyages advisor will take over to help you."
  },
  bn: {
    unsupported_media: "দুঃখিত, আমি এই ধরনের ফাইল এখন প্রক্রিয়া করতে পারছি না। আপনার অনুরোধটি লিখে জানান।",
    handoff_ack: "আপনার তথ্যের জন্য ধন্যবাদ। AMI Voyages-এর একজন উপদেষ্টা শীঘ্রই আপনার সাথে যোগাযোগ করবেন।",
    no_transcription: "আমি আপনার ভয়েস বার্তাটি বুঝতে পারিনি। অনুগ্রহ করে এটি টেক্সটে লিখে পাঠান।",
    audio_error: "আপনার ভয়েস বার্তা প্রক্রিয়া করতে সমস্যা হয়েছে। প্রয়োজনে একজন উপদেষ্টা সাহায্য করবেন।",
    empty_message: "আমি শুনছি। আপনার প্রয়োজনের কথা একটু বিস্তারিত বলুন।",
    unknown_message: "আমি আপনার অনুরোধটি ভালোভাবে বুঝতে পারিনি। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সাহায্য করবেন।"
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
// DETECTION CONTACT / REFERENCE
// =====================================================================
function isPhoneNumber(text) {
  if (!text) return false;
  const digits = String(text).replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}
 
function looksLikeReference(text) {
  if (!text) return false;
  const s = String(text).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!/^[A-Z0-9]{6,10}$/.test(s)) return false;
  if (!/[A-Z]/.test(s) || !/[0-9]/.test(s)) return false;
  const blacklist = ['CONTACT', 'REFERENCE', 'NUMERO', 'PHONE', 'BOOKING', 'TICKET'];
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
    /\bprice\s+for\s+([a-z][a-z\s]{1,60})/,
    // Banglish
    /\bami\s+([a-z]{3,30})\s+(?:jete|jabo|zabo|jaite|jaibo)\s+chai\b/,
    /\b([a-z]{3,30})\s+jete\s+chai\b/,
    /\b([a-z]{3,30})\s+(?:ticket|tiket)\s+(?:lagbe|chai)\b/
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return '';
}
 
// =====================================================================
// GESTION DES SALUTATIONS EN TETE DE MESSAGE
// =====================================================================
function parseLeadingGreeting(text = '', lang = 'fr') {
  const normalized = normalizeText(text);
 
  if (lang === 'en') {
    const match = normalized.match(/^(?:hello|hi|hey|good morning|good afternoon|good evening)\b[\s,]*(.*)$/);
    if (match) {
      const rest = String(match[1] || '').trim();
      return { greeting: 'Hello', rest, isOnlyGreeting: rest.length === 0 };
    }
  } else if (lang === 'bn') {
    const matchSalam = normalized.match(/^(?:salam(?:\s+aleykoum)?|assalamu alaikum|assalamualaikum)\b[\s,]*(.*)$/);
    if (matchSalam) {
      const rest = String(matchSalam[1] || '').trim();
      return { greeting: 'Walaikum assalam', rest, isOnlyGreeting: rest.length === 0 };
    }
    const matchHello = normalized.match(/^(?:hello|hi|hey)\b[\s,]*(.*)$/);
    if (matchHello) {
      const rest = String(matchHello[1] || '').trim();
      return { greeting: 'Hello', rest, isOnlyGreeting: rest.length === 0 };
    }
  } else {
    const matchBonjour = normalized.match(/^(?:bonjour|salut|coucou|bonsoir)\b[\s,]*(.*)$/);
    if (matchBonjour) {
      const rest = String(matchBonjour[1] || '').trim();
      return { greeting: 'Bonjour', rest, isOnlyGreeting: rest.length === 0 };
    }
    const matchSalam = normalized.match(/^salam(?:\s+aleykoum)?\b[\s,]*(.*)$/);
    if (matchSalam) {
      const rest = String(matchSalam[1] || '').trim();
      return { greeting: 'Walaikum salam', rest, isOnlyGreeting: rest.length === 0 };
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
// INTENTIONS (triées par priorité décroissante)
// =====================================================================
const INTENTS = [
  {
    name: 'vol_annule_retarde',
    priority: 130,
    handoff: true,
    tests: [
      /\bvol annule\b/, /\bvol retarde\b/, /\bmon vol (?:a ete |est )?annule\b/,
      /\bmon vol (?:a ete |est )?retarde\b/, /\bflight cancel(?:l)?ed\b/,
      /\bmy flight (?:was |is )?cancel(?:l)?ed\b/, /\bflight delay(?:ed)?\b/,
      /\bmy flight (?:is |was )?delayed\b/,
      // Banglish / Bengali
      /\bflight cancel\b/, /\bamar flight cancel\b/, /\bcancel ho(?:ye)?(?:che|gese|geche)?\b/,
      /\bflight bondho\b/, /\bflight deri\b/, /\bフlight late\b/,
      /আমার ফ্লাইট ক্যান্সেল/, /ফ্লাইট বাতিল/, /ফ্লাইট দেরি/
    ],
    response: {
      fr: "Nous sommes désolés pour la gêne occasionnée. Merci d'indiquer votre référence de dossier, votre numéro de téléphone et le nom du passager. Un conseiller AMI Voyages prendra votre dossier en charge dès que possible.",
      en: "We are sorry for the inconvenience. Please provide your booking reference, your phone number and the passenger's name. An AMI Voyages advisor will assist you as soon as possible.",
      bn: "অসুবিধার জন্য আমরা দুঃখিত। অনুগ্রহ করে আপনার বুকিং রেফারেন্স, ফোন নম্বর এবং যাত্রীর নাম জানান। AMI Voyages-এর একজন উপদেষ্টা যত তাড়াতাড়ি সম্ভব আপনার সাথে যোগাযোগ করবেন।"
    }
  },
  {
    name: 'confirmation_vol',
    priority: 125,
    handoff: true,
    tests: [
      /\bstatut de mon vol\b/, /\best ce que mon vol est confirme\b/,
      /\bmon vol (?:est |)confirme\b/, /\bflight status\b/, /\bis my flight confirmed\b/,
      /\bmy (?:flight|booking) confirm(?:ed|ation)?\b/,
      // Banglish / Bengali
      /\bflight confirm\b/, /\bamar flight confirmed\b/, /\bticket confirmed\b/,
      /\bconfirm hoye(?:che)?\b/, /\bconfirm ache\b/,
      /আমার ফ্লাইট কনফার্ম/, /টিকেট কনফার্ম/
    ],
    response: {
      fr: "Merci de nous envoyer la référence de votre billet, votre numéro de billet ou la copie du passeport du passager. Un conseiller AMI Voyages prendra ensuite le relais. Vous pouvez aussi consulter le site de la compagnie aérienne.",
      en: "Please send us your ticket reference, ticket number or a copy of the passenger's passport. An AMI Voyages advisor will then assist you. You can also check the airline's website directly.",
      bn: "অনুগ্রহ করে আপনার টিকেট রেফারেন্স, টিকেট নম্বর বা যাত্রীর পাসপোর্টের কপি পাঠান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন। আপনি সরাসরি এয়ারলাইনের ওয়েবসাইটেও দেখতে পারেন।"
    }
  },
  {
    name: 'annulation_billet',
    priority: 120,
    handoff: true,
    tests: [
      /\bannuler mon billet\b/, /\bje veux annuler\b/, /\bannulation\b/, /\banulasion\b/,
      /\bannuller\b/, /\bcancel my ticket\b/, /\bcancel my booking\b/,
      /\bi want to cancel\b/, /\bcancell?ation\b/, /\bcancell\b/,
      // Banglish / Bengali
      /\bticket cancel\b/, /\bbooking cancel\b/, /\bcancel korte chai\b/,
      /\bcancel korten\b/, /\bcancel lagbe\b/, /\bticket cancel kori\b/,
      /\bcancel diben\b/, /\bcancel korben\b/,
      /টিকেট বাতিল/, /বুকিং বাতিল/, /বাতিল করতে চাই/
    ],
    response: {
      fr: "Les conditions d'annulation dépendent du billet réservé et des règles tarifaires de la compagnie. Si vous avez un dossier, merci de nous communiquer votre référence et le nom du passager. Un conseiller AMI Voyages prendra le relais.",
      en: "Cancellation conditions depend on the booked ticket and the airline's fare rules. If you have a booking, please send us your reference and the passenger's name. An AMI Voyages advisor will assist you.",
      bn: "বাতিলের শর্তাবলী বুক করা টিকেট এবং এয়ারলাইনের নিয়মের উপর নির্ভর করে। আপনার যদি বুকিং থাকে, অনুগ্রহ করে আপনার রেফারেন্স এবং যাত্রীর নাম জানান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।"
    }
  },
  {
    name: 'modification_billet',
    priority: 118,
    handoff: true,
    tests: [
      /\bmodifier mon billet\b/, /\bmodifier mon vol\b/, /\bchanger mon vol\b/,
      /\bje veux changer mon billet\b/, /\bchanger mon billet\b/,
      /\bchanger la date\b/, /\bchangement de date\b/, /\bmodif\b/, /\bchnage\b/,
      /\bmodify my (?:ticket|flight|booking)\b/, /\bchange my (?:ticket|flight|booking|date)\b/,
      /\bi want to change my flight\b/, /\bchange flight date\b/, /\bdate change\b/,
      // Banglish / Bengali
      /\bticket change\b/, /\bflight change\b/, /\bdate change korte\b/,
      /\bchange korbo\b/, /\bmodify korte\b/, /\bbooking change\b/,
      /\bdate badlate\b/, /\bdate poriborton\b/,
      /টিকেট পরিবর্তন/, /তারিখ পরিবর্তন/, /ফ্লাইট পরিবর্তন/
    ],
    response: {
      fr: "Une modification doit être vérifiée par un conseiller selon les conditions du billet. Merci d'indiquer votre référence de dossier et votre demande précise. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "A change needs to be verified by an advisor based on the ticket conditions. Please provide your booking reference and your specific request. An AMI Voyages advisor will then assist you.",
      bn: "পরিবর্তন করতে হলে টিকেটের শর্ত অনুযায়ী একজন উপদেষ্টার যাচাই করা দরকার। অনুগ্রহ করে আপনার বুকিং রেফারেন্স এবং নির্দিষ্ট অনুরোধটি জানান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।"
    }
  },
  {
    name: 'verification_dossier',
    priority: 115,
    handoff: true,
    tests: [
      /\bverifier mon dossier\b/, /\bverification de dossier\b/, /\bstatut de mon dossier\b/,
      /\bcheck my booking\b/, /\bverify my booking\b/, /\bbooking status\b/,
      /\bcan you check my booking\b/,
      // Banglish / Bengali
      /\bamar booking check\b/, /\bbooking check korun\b/, /\bdossier check\b/,
      /\bdossier dekhen\b/, /\bbooking confirm ache\b/, /\bbuking check\b/,
      /বুকিং চেক/, /আমার বুকিং চেক করুন/
    ],
    response: {
      fr: "Oui, un conseiller peut vérifier votre dossier. Merci d'indiquer votre référence de dossier et le nom du passager. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Yes, an advisor can check your booking. Please provide your booking reference and the passenger's name. An AMI Voyages advisor will then assist you.",
      bn: "হ্যাঁ, একজন উপদেষ্টা আপনার বুকিং যাচাই করতে পারবেন। অনুগ্রহ করে আপনার বুকিং রেফারেন্স এবং যাত্রীর নাম জানান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।"
    }
  },
  {
    name: 'prix_disponibilite',
    priority: 110,
    handoff: true,
    tests: [
      /\bprix\b/, /\btarif\b/, /\btarf\b/, /\bpri\b/, /\bcombien\b/, /\bcombient\b/,
      /\bcbien\b/, /\bcmbien\b/, /\bc est combien\b/, /\bca coute combien\b/,
      /\bdisponibilite\b/, /\bvous avez dispo\b/, /\bdispo\s+p(?:ou)?r\b/,
      /\bavez vous des places\b/, /\bvous avez des places\b/, /\bplaces disponibles\b/,
      /\bhow much\b/, /\bcost\b/, /\bflight cost\b/, /\bfare\b/, /\bfares\b/,
      /\bany availability\b/, /\bseats available\b/, /\bavailability\b/, /\bavailible\b/,
      /\bcheck availability\b/, /\bprice for\b/, /\bprice of\b/, /\bflight price\b/,
      // Banglish / Bengali
      /\bprice koto\b/, /\brate koto\b/, /\bkoto taka\b/, /\bdaam koto\b/,
      /\bticket price\b/, /\bflight ache\b/, /\bseat ache\b/, /\bsit ache\b/,
      /\bprice chai\b/, /\brate chai\b/, /\bdame koto\b/,
      /দাম কত/, /টিকেটের দাম/, /কত টাকা/, /সিট আছে/, /ফ্লাইট আছে/
    ],
    response: {
      fr: "Les prix varient selon la destination, la date, la compagnie et les places disponibles. Merci d'indiquer : destination, ville de départ et de retour, dates, nombre de passagers et vos préférences (compagnie, vol direct ou prix le plus bas). Un conseiller AMI Voyages vous répondra.",
      en: "Prices vary by destination, date, airline and seat availability. Please tell us: your destination, departure and return city, dates, number of passengers and your preference (airline, direct flight or lowest price). An AMI Voyages advisor will assist you.",
      bn: "গন্তব্য, তারিখ, এয়ারলাইন ও আসনের উপর নির্ভর করে দাম পরিবর্তন হয়। অনুগ্রহ করে জানান: গন্তব্য, ছাড়ার ও ফেরার শহর, তারিখ, যাত্রীর সংখ্যা এবং আপনার পছন্দ (এয়ারলাইন, সরাসরি ফ্লাইট বা সর্বনিম্ন দাম)। AMI Voyages-এর একজন উপদেষ্টা আপনাকে জবাব দেবেন।"
    }
  },
  {
    name: 'devis',
    priority: 108,
    handoff: true,
    tests: [
      /\bdevis\b/, /\bje veux un devis\b/, /\bbesoin de devis\b/, /\bquote\b/,
      /\bi want a quote\b/, /\bi need a quote\b/, /\bcan i get a quote\b/,
      // Banglish / Bengali
      /\bquote chai\b/, /\bestimate lagbe\b/, /\bquote diben\b/,
      /কোটেশন/, /দাম জানতে চাই/
    ],
    response: {
      fr: "Oui, nous pouvons vous faire un devis. Merci d'indiquer : destination, ville de départ et de retour, dates, nombre de passagers et votre numéro de téléphone. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Yes, we can provide a quote. Please provide: your destination, departure and return city, dates, number of passengers and your phone number. An AMI Voyages advisor will then assist you.",
      bn: "হ্যাঁ, আমরা আপনাকে একটি কোটেশন দিতে পারি। অনুগ্রহ করে জানান: গন্তব্য, ছাড়ার ও ফেরার শহর, তারিখ, যাত্রীর সংখ্যা এবং আপনার ফোন নম্বর। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।"
    }
  },
  {
    name: 'paiement_conditions',
    priority: 106,
    handoff: true,
    tests: [
      /\bmoyens de paiement\b/, /\bconditions de paiement\b/, /\bmodalites? de paiement\b/,
      /\bcomment payer\b/, /\bpayment method\b/, /\bpayment options?\b/,
      /\bhow do i pay\b/, /\bhow can i pay\b/,
      // Banglish / Bengali
      /\bkiভabe payment\b/, /\bpayment kivabe\b/, /\bpayment er niyom\b/,
      /\bpayment method\b/, /\bkiভabe taka dibo\b/, /\bpayment kore\b/,
      /পেমেন্টের নিয়ম/, /কিভাবে পেমেন্ট করব/
    ],
    response: {
      fr: "Nous acceptons les virements bancaires, les espèces, les chèques ANCV et chèques-vacances / Connect. Un lien de paiement en ligne peut aussi être envoyé. Un paiement en plusieurs fois peut être possible, sous conditions.",
      en: "We accept bank transfers, cash, ANCV vouchers and holiday vouchers / Connect. An online payment link can also be sent. Payment in installments may be possible under certain conditions.",
      bn: "আমরা ব্যাংক ট্রান্সফার, নগদ, ANCV ভাউচার এবং ছুটির ভাউচার গ্রহণ করি। অনলাইন পেমেন্ট লিঙ্কও পাঠানো যেতে পারে। নির্দিষ্ট শর্তে কিস্তিতে পেমেন্টও সম্ভব হতে পারে।"
    }
  },
  {
    name: 'lien_paiement',
    priority: 105,
    handoff: true,
    tests: [
      /\blien de paiement\b/, /\benvoyer (?:un |le )?lien de paiement\b/,
      /\bpayment link\b/, /\bsend (?:me )?(?:a |the )?payment link\b/,
      /\blink de paiement\b/,
      // Banglish / Bengali
      /\bpayment link pathan\b/, /\bpayment link den\b/, /\bpayment link chai\b/,
      /\blink pathan\b/, /\blink pathao\b/,
      /পেমেন্ট লিংক পাঠান/, /পেমেন্ট লিংক চাই/
    ],
    response: {
      fr: "Merci de nous envoyer votre facture d'achat ou, à défaut, une copie du passeport du passager. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Please send us your invoice or, failing that, a copy of the passenger's passport. An AMI Voyages advisor will then assist you.",
      bn: "অনুগ্রহ করে আপনার চালান বা যাত্রীর পাসপোর্টের কপি পাঠান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।"
    }
  },
  {
    name: 'paiement_distance',
    priority: 104,
    handoff: true,
    tests: [
      /\bpaiement a distance\b/, /\bpaiement en ligne\b/, /\btelepaiement\b/,
      /\bonline payment\b/, /\bremote payment\b/, /\bpay online\b/, /\bpay remotely\b/,
      // Banglish / Bengali
      /\bonline peyment\b/, /\bonline taka dibo\b/, /\bonline payment korte chai\b/,
      /অনলাইন পেমেন্ট/
    ],
    response: {
      fr: "Un paiement à distance par carte bancaire via lien de paiement sécurisé est possible selon le dossier. Merci de nous envoyer votre facture ou une copie du passeport du passager. Un conseiller AMI Voyages prendra le relais.",
      en: "Remote card payment via a secure payment link is possible depending on the booking. Please send us your invoice or a copy of the passenger's passport. An AMI Voyages advisor will then assist you.",
      bn: "বুকিংয়ের উপর নির্ভর করে নিরাপদ পেমেন্ট লিঙ্কের মাধ্যমে কার্ড পেমেন্ট সম্ভব। অনুগ্রহ করে আপনার চালান বা পাসপোর্টের কপি পাঠান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।"
    }
  },
  {
    name: 'visa',
    priority: 102,
    handoff: true,
    tests: [
      /\bvisa\b/, /\bviza\b/, /\bdemande de visa\b/, /\bvisa pour\b/,
      /\bvisa application\b/, /\bvisa for\b/, /\bvisa info\b/, /\bneed visa\b/,
      // Banglish / Bengali
      /\bvisa lagbe\b/, /\bvisa chai\b/, /\bvisa lage\b/, /\bvisa diben\b/,
      /\bbiza lagbe\b/, /\bvisa niyom\b/, /\bvisa er jonno\b/,
      /\bamar visa\b/, /\bvisit visa\b/, /\bstudent visa\b/,
      /ভিসা লাগবে/, /ভিসার জন্য/, /আমার ভিসা/, /ভিসা চাই/
    ],
    response: {
      fr: "Nous proposons une assistance visa pour certaines destinations uniquement. Indiquez-nous votre destination et votre nationalité afin de vérifier si nous pouvons vous aider. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "We offer visa assistance for certain destinations only. Please tell us your destination and nationality so we can check if we can help. An AMI Voyages advisor will then assist you.",
      bn: "আমরা শুধুমাত্র কিছু নির্দিষ্ট গন্তব্যের জন্য ভিসা সহায়তা প্রদান করি। অনুগ্রহ করে আপনার গন্তব্য এবং জাতীয়তা জানান যাতে আমরা সাহায্য করতে পারি কিনা তা যাচাই করতে পারি। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।"
    }
  },
  {
    name: 'documents_voyage',
    priority: 100,
    handoff: true,
    tests: [
      /\bdocuments? pour voyager\b/, /\bdocuments? requis\b/, /\bquels? documents\b/,
      /\bquels? papiers\b/, /\btravel documents\b/, /\brequired documents\b/,
      /\bwhat documents\b/,
      // Banglish / Bengali
      /\bki document lagbe\b/, /\bdocument er list\b/, /\bkagoj lagbe\b/,
      /\bki ki lagbe\b/, /\bkagojpatra\b/,
      /কী কী দরকার/, /কোন কাগজ লাগবে/
    ],
    response: {
      fr: "Les documents nécessaires dépendent de la destination, de votre nationalité et du type de voyage. Indiquez-nous ces informations afin que nous puissions vous orienter. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Required documents depend on the destination, your nationality and the type of trip. Please tell us these details so we can guide you. An AMI Voyages advisor will then assist you.",
      bn: "প্রয়োজনীয় কাগজপত্র গন্তব্য, আপনার জাতীয়তা এবং ভ্রমণের ধরনের উপর নির্ভর করে। অনুগ্রহ করে এই তথ্যগুলি জানান যাতে আমরা আপনাকে সঠিক পথ দেখাতে পারি। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।"
    }
  },
  {
    name: 'passeport',
    priority: 98,
    handoff: true,
    tests: [
      /\bpasseport\b/, /\bpasport\b/, /\bpassport\b/, /\bmon passeport\b/,
      /\bpassport valid\b/, /\bis my passport valid\b/, /\bpassport validity\b/,
      // Banglish / Bengali
      /\bpassport valid ache\b/, /\bpassport lagbe\b/, /\bpassport er meaad\b/,
      /\bpassport expire\b/, /\bpassport renew\b/, /\bpasport valid\b/,
      /\bpassport check\b/, /\bpassport niyom\b/,
      /পাসপোর্ট বৈধ/, /পাসপোর্টের মেয়াদ/, /পাসপোর্ট চেক/
    ],
    response: {
      fr: "La durée de validité requise pour le passeport dépend de la destination (souvent 6 mois après la date de retour). Indiquez-nous votre destination et la date d'expiration de votre passeport afin que nous puissions vérifier. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "The required passport validity depends on the destination (often 6 months after the return date). Please tell us your destination and your passport's expiry date so we can check. An AMI Voyages advisor will then assist you.",
      bn: "পাসপোর্টের প্রয়োজনীয় বৈধতার মেয়াদ গন্তব্যের উপর নির্ভর করে (প্রায়ই ফেরার তারিখের পরে ৬ মাস)। অনুগ্রহ করে আপনার গন্তব্য এবং পাসপোর্টের মেয়াদ শেষ হওয়ার তারিখ জানান। AMI Voyages-এর একজন উপদেষ্টা যাচাই করবেন।"
    }
  },
  {
    name: 'omra_hajj',
    priority: 96,
    handoff: true,
    tests: [
      /\bomra\b/, /\bhajj\b/, /\bumrah\b/, /\bumra\b/,
      // Banglish / Bengali
      /\bomra korte chai\b/, /\bhajj er ticket\b/, /\bumra flight\b/,
      /ওমরা/, /হজ/, /ওমরাহ/
    ],
    response: {
      fr: "Oui, nous pouvons vous accompagner pour les voyages omra et hajj selon la période et les disponibilités. Indiquez-nous votre destination, vos villes de départ et de retour, vos dates et le nombre de passagers. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Yes, we can assist you with Umrah and Hajj trips depending on the period and availability. Please tell us your destination, departure and return city, dates and the number of passengers. An AMI Voyages advisor will then assist you.",
      bn: "হ্যাঁ, আমরা ওমরা ও হজ্জ যাত্রার জন্য আপনাকে সহায়তা করতে পারি, সময় ও প্রাপ্যতার উপর নির্ভর করে। আপনার গন্তব্য, ছাড়ার ও ফেরার শহর, তারিখ এবং যাত্রীর সংখ্যা জানান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।"
    }
  },
  {
    name: 'grossesse',
    priority: 95,
    handoff: true,
    tests: [
      /\bfemme enceinte\b/, /\benceinte\b/, /\bgrossesse\b/, /\bpregnant\b/, /\bpregnancy\b/,
      // Banglish / Bengali
      /\bgarbhaboti\b/, /\bgorbha\b/, /\bpregnant mohila\b/, /\benciente\b/,
      /গর্ভবতী/, /গর্ভাবস্থা/
    ],
    response: {
      fr: "Les femmes enceintes peuvent généralement voyager jusqu'à 6 mois. Au-delà, une autorisation médicale est requise, sous réserve d'acceptation par la compagnie et les services aéroportuaires. Consultez aussi votre médecin.",
      en: "Pregnant women can generally travel up to 6 months. Beyond that, a medical authorization is required, subject to acceptance by the airline and airport services. We also recommend consulting your doctor.",
      bn: "গর্ভবতী মহিলারা সাধারণত ৬ মাস পর্যন্ত ভ্রমণ করতে পারেন। এর বেশি হলে চিকিৎসা সংক্রান্ত অনুমতি প্রয়োজন, এয়ারলাইন ও বিমানবন্দর পরিষেবার অনুমোদন সাপেক্ষে। আপনার ডাক্তারের সাথেও পরামর্শ করুন।"
    }
  },
  {
    name: 'bebe_tarif',
    priority: 94,
    handoff: false,
    tests: [
      /\bbebe tarif\b/, /\btarif bebe\b/, /\btarif (?:pour |un )?bebe\b/,
      /\bbaby fare\b/, /\bbaby price\b/,
      // Banglish / Bengali
      /\bbaby ticket price\b/, /\bshishu ticket\b/, /\bbackha ticket\b/,
      /\bbaby r ticket\b/, /\binfant ticket\b/,
      /শিশুর টিকেট/, /বাচ্চার ভাড়া/
    ],
    response: {
      fr: "De 1 jour à moins de 2 ans : catégorie bébé, paie généralement les taxes aéroport. De 2 à moins de 12 ans : catégorie enfant. À partir de 12 ans : tarif adulte. Ces règles varient selon la compagnie.",
      en: "From 1 day to under 2 years: baby category, generally pays airport taxes only. From 2 to under 12 years: child category. From 12 years: adult fare. These rules may vary by airline.",
      bn: "১ দিন থেকে ২ বছরের কম: শিশু শ্রেণী, সাধারণত শুধু বিমানবন্দর কর দেয়। ২ থেকে ১২ বছরের কম: শিশু শ্রেণী। ১২ বছর থেকে: প্রাপ্তবয়স্ক ভাড়া। এই নিয়মগুলি এয়ারলাইন অনুযায়ী পরিবর্তিত হতে পারে।"
    }
  },
  {
    name: 'bebe_bagage',
    priority: 93,
    handoff: false,
    tests: [
      /\bbebe bagage\b/, /\bbagage bebe\b/, /\bbagage (?:pour |de )?bebe\b/,
      /\bbaby baggage\b/, /\bbaby luggage\b/, /\binfant baggage\b/,
      // Banglish / Bengali
      /\bbaby r bag\b/, /\bshishu r bag\b/, /\bbaby bagage\b/,
      /\binfant bag\b/, /\bbaby luggage rule\b/,
      /শিশুর লাগেজ/, /বাচ্চার ব্যাগ/
    ],
    response: {
      fr: "En général, les bébés ont droit aux bagages, mais cela dépend de la compagnie. Chez Saudia Airlines par exemple, c'est 23 kilos.",
      en: "Generally, babies are entitled to baggage allowance, but this depends on the airline. With Saudia Airlines for example, it's 23 kilos.",
      bn: "সাধারণত শিশুরা লাগেজ ভাতা পায়, তবে এটি এয়ারলাইনের উপর নির্ভর করে। যেমন, Saudia Airlines-এ এটি ২৩ কেজি।"
    }
  },
  {
    name: 'enfant_bagage',
    priority: 92,
    handoff: false,
    tests: [
      /\benfant bagage\b/, /\bbagage enfant\b/, /\bbagage pour enfant\b/,
      /\bchild baggage\b/, /\bchild luggage\b/,
      // Banglish / Bengali
      /\bshishu bag\b/, /\bbackha bag\b/, /\bchele r bag\b/, /\bchild er bag\b/,
      /\bbacha r luggage\b/,
      /শিশুর ব্যাগের নিয়ম/, /বাচ্চার লাগেজ/
    ],
    response: {
      fr: "Les bagages pour les enfants suivent généralement les mêmes normes que pour les adultes, mais cela peut dépendre de la compagnie aérienne.",
      en: "Baggage for children generally follows the same rules as for adults, but this may depend on the airline.",
      bn: "শিশুদের জন্য লাগেজের নিয়ম সাধারণত প্রাপ্তবয়স্কদের মতোই, তবে এটি এয়ারলাইনের উপর নির্ভর করতে পারে।"
    }
  },
  {
    name: 'demande_humain',
    priority: 90,
    handoff: true,
    tests: [
      /\bun agent\b/, /\bun conseiller\b/, /\bhumain\b/, /\bservice client\b/,
      /\bparler a un agent\b/, /\bparler a un conseiller\b/, /\bparler a quelqu un\b/,
      /\bhuman\b/, /\bcustomer service\b/, /\bspeak to (?:a |an )?(?:agent|human|person)\b/,
      /\btalk to (?:a |an )?(?:agent|human|person)\b/, /\breal person\b/,
      // Banglish / Bengali
      /\bagent er shathe kotha\b/, /\bmanush er sathe kotha\b/, /\badvisor lagbe\b/,
      /\bagent lagbe\b/, /\bconsultant lagbe\b/, /\baijent\b/,
      /\bkta bolte chai\b/, /\bkotha bolte chai\b/,
      /এজেন্টের সাথে কথা/, /মানুষের সাথে কথা বলব/, /পরামর্শদাতা লাগবে/
    ],
    response: {
      fr: "Bien sûr. Merci d'indiquer votre nom, votre numéro de téléphone et l'objet de votre demande. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Of course. Please provide your name, your phone number and the subject of your request. An AMI Voyages advisor will then assist you.",
      bn: "অবশ্যই। অনুগ্রহ করে আপনার নাম, ফোন নম্বর এবং অনুরোধের বিষয় জানান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।"
    }
  },
  {
    name: 'rappel_client',
    priority: 88,
    handoff: true,
    tests: [
      /\bappelez moi\b/, /\bappel moi\b/, /\bme rappeler\b/, /\bpouvez vous me rappeler\b/,
      /\bdemande de rappel\b/, /\bcall me\b/, /\bcall me back\b/, /\bcan you call me\b/,
      // Banglish / Bengali
      /\bcall diben\b/, /\bcall korun\b/, /\bcall koren\b/, /\bcall deo\b/,
      /\bphone diben\b/, /\bfone koren\b/, /\bkorun call\b/,
      /কল দিন/, /ফোন করুন/, /আমাকে কল করুন/
    ],
    response: {
      fr: "Oui, nous pouvons transmettre votre demande à un conseiller. Merci d'indiquer votre nom et le sujet de votre demande. Un conseiller AMI Voyages prendra le relais.",
      en: "Yes, we can forward your request to an advisor. Please provide your name and the subject of your request. An AMI Voyages advisor will take over.",
      bn: "হ্যাঁ, আমরা আপনার অনুরোধ একজন উপদেষ্টার কাছে পাঠাতে পারি। অনুগ্রহ করে আপনার নাম এবং অনুরোধের বিষয় জানান। AMI Voyages-এর একজন উপদেষ্টা দায়িত্ব নেবেন।"
    }
  },
  {
    name: 'projet_voyage',
    priority: 85,
    handoff: true,
    tests: [
      /\bje veux (?:aller|voyager|partir)\b/, /\bj aimerais (?:aller|voyager|partir)\b/,
      /\bje voudrais (?:aller|voyager|partir)\b/, /\bje souhaite (?:aller|voyager|partir)\b/,
      /\bbil(?:l)?et\s+p(?:ou)?r\b/, /\bvol\s+p(?:ou)?r\b/, /\bpartir\s+(?:p(?:ou)?r|en|a|au|aux|vers)\b/,
      /\bvoyager\s+(?:p(?:ou)?r|en|a|au|aux|vers)\b/, /\baller (?:au|aux|en|a)\b/,
      /\bi want (?:a |to )?ticket\b/, /\bi want to (?:go|travel|fly)\b/,
      /\bi need (?:a )?ticket\b/, /\bticket to\b/, /\btravel to\b/, /\bflight to\b/,
      /\bi d like to (?:go|travel|fly)\b/,
      // Banglish / Bengali
      /\bami ticket chai\b/, /\bamar ticket lagbe\b/, /\bticket lagbe\b/, /\btiket lagbe\b/,
      /\bami dhaka jete chai\b/, /\bami bangladesh jabo\b/, /\bjete chai\b/,
      /\bjabo\b/, /\bzabo\b/, /\bami (?:\w+)\s+jete chai\b/,
      /আমি টিকেট চাই/, /আমার টিকেট লাগবে/, /আমি ঢাকা যেতে চাই/
    ],
    response: {
      fr: "Nous pouvons vous aider à organiser votre voyage. Merci d'indiquer votre destination, votre ville de départ, vos dates de départ et de retour, et le nombre de passagers. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "We can help you organize your trip. Please tell us your destination, departure city, departure and return dates, and the number of passengers. An AMI Voyages advisor will then assist you.",
      bn: "আমরা আপনার ভ্রমণ পরিকল্পনায় সাহায্য করতে পারি। অনুগ্রহ করে আপনার গন্তব্য, ছাড়ার শহর, যাওয়া ও আসার তারিখ এবং যাত্রীর সংখ্যা জানান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।"
    }
  },
  {
    name: 'horaires_ouverture',
    priority: 80,
    handoff: false,
    tests: [
      /\bhoraire\b/, /\bhoraires\b/, /\bheur\b/, /\bheures d ouverture\b/, /\bvos horaires\b/,
      /\bquels sont vos horaires\b/, /\bc quoi vos horaires\b/, /\bvous etes ouvert\b/,
      /\bvous ouvrez\b/, /\bvous fermez\b/, /\bouvert aujourd hui\b/,
      /\bopening hours\b/, /\bwhat time (?:do you )?open\b/, /\bwhat time (?:do you )?close\b/,
      /\bare you open\b/, /\bopen today\b/, /\bbusiness hours\b/,
      // Banglish / Bengali
      /\bkokhon open\b/, /\bkobe open\b/, /\boffice khola\b/, /\bkholar shomoy\b/,
      /\bkholar somoy\b/, /\bshomoy ki\b/, /\bsomoy ki\b/, /\boffice time\b/,
      /\bkobe khule\b/,
      /কখন খোলা/, /অফিস কখন খোলে/, /সময় কত/
    ],
    response: {
      fr: "Nos horaires : AMI Voyages Paris Gare du Nord, 157 rue Lafayette 75010 Paris, du lundi au samedi de 10h00 à 18h30. AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République 93300 Aubervilliers, du mardi au vendredi de 10h00 à 18h30. Vous pouvez aussi nous écrire ici sur WhatsApp.",
      en: "Our hours: AMI Voyages Paris Gare du Nord, 157 rue Lafayette 75010 Paris, Monday to Saturday 10:00am–6:30pm. AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République 93300 Aubervilliers, Tuesday to Friday 10:00am–6:30pm. You can also write to us here on WhatsApp.",
      bn: "আমাদের সময়সূচি: AMI Voyages Paris Gare du Nord, 157 rue Lafayette 75010 Paris, সোমবার থেকে শনিবার সকাল ১০টা থেকে সন্ধ্যা ৬:৩০টা। AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République 93300 Aubervilliers, মঙ্গলবার থেকে শুক্রবার সকাল ১০টা থেকে সন্ধ্যা ৬:৩০টা। আপনি WhatsApp-এও আমাদের লিখতে পারেন।"
    }
  },
  {
    name: 'localisation_agences',
    priority: 75,
    handoff: false,
    tests: [
      /\badresse\b/, /\badress\b/, /\bou (?:etes|es) vous\b/, /\bou se trouve votre agence\b/,
      /\blocalisation\b/, /\bwhere are you\b/, /\blocation\b/, /\baddress\b/,
      /\boffice address\b/, /\bwhere is your office\b/,
      // Banglish / Bengali
      /\boffice kothay\b/, /\bkothay office\b/, /\boffice address den\b/,
      /\bshop kothay\b/, /\bagency kothay\b/, /\baddress den\b/, /\bkothay achen\b/,
      /অফিস কোথায়/, /ঠিকানা দিন/
    ],
    response: {
      fr: "Nos agences : AMI Voyages Paris Gare du Nord, 157 rue Lafayette 75010 Paris (Métro Gare du Nord). AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République 93300 Aubervilliers (Métro Quatre Chemins).",
      en: "Our branches: AMI Voyages Paris Gare du Nord, 157 rue Lafayette 75010 Paris (Metro Gare du Nord). AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République 93300 Aubervilliers (Metro Quatre Chemins).",
      bn: "আমাদের শাখা: AMI Voyages Paris Gare du Nord, 157 rue Lafayette 75010 Paris (মেট্রো Gare du Nord)। AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République 93300 Aubervilliers (মেট্রো Quatre Chemins)।"
    }
  },
  {
    name: 'destination_couverte',
    priority: 70,
    handoff: false,
    tests: [
      /\bbangladesh\b/, /\binde\b/, /\bindia\b/, /\bsri lanka\b/, /\bmali\b/,
      /\bsenegal\b/, /\bguinee\b/, /\bguinea\b/, /\brdc\b/, /\bdr congo\b/,
      /\bdhaka\b/, /\bdakar\b/, /\bcolombo\b/, /\baccra\b/, /\babidjan\b/,
      /\bchittagong\b/, /\bsylhet\b/, /\bvous allez au bangladesh\b/,
      /\bvous faites le bangladesh\b/,
      // Banglish / Bengali
      /\bbangladesh er ticket\b/, /\bdhaka ticket\b/, /\bindia flight\b/,
      /বাংলাদেশের টিকেট/, /ঢাকার টিকেট/
    ],
    response: {
      fr: "Oui, nous travaillons sur cette destination. Merci d'indiquer votre ville de départ et de retour, vos dates, le nombre de passagers et vos préférences. Un agent vous indiquera le meilleur prix.",
      en: "Yes, we work on this destination. Please tell us your departure and return city, your dates, number of passengers and any preferences. An agent will give you the best price.",
      bn: "হ্যাঁ, আমরা এই গন্তব্যে কাজ করি। অনুগ্রহ করে আপনার ছাড়ার ও ফেরার শহর, তারিখ, যাত্রীর সংখ্যা এবং আপনার পছন্দ জানান। একজন এজেন্ট আপনাকে সেরা দাম জানাবেন।"
    }
  },
  {
    name: 'promos',
    priority: 65,
    handoff: false,
    tests: [
      /\bpromo\b/, /\bpromos\b/, /\boffre speciale\b/, /\boffres speciales\b/,
      /\bspecial offer\b/, /\bdiscount\b/, /\bpromotion\b/,
      // Banglish / Bengali
      /\bpromo ache\b/, /\bdiscounts ache\b/, /\bkam damey\b/, /\bshosta ticket\b/,
      /\bsshosta ticket\b/,
      /ছাড় আছে/, /প্রমো আছে/
    ],
    response: {
      fr: "Nous proposons des tarifs avantageux au départ de la France avec retour en France, ainsi que sur Lisbonne-Dhaka. Les meilleurs tarifs sont en général hors vacances scolaires et hors week-end. Indiquez-nous votre destination, vos villes, vos dates et le nombre de passagers.",
      en: "We offer competitive fares departing from France returning to France, as well as on Lisbon-Dhaka. The best fares are usually outside school holidays and weekends. Please tell us your destination, cities, dates and number of passengers.",
      bn: "আমরা ফ্রান্স থেকে ছেড়ে ফ্রান্সে ফেরার প্রতিযোগিতামূলক ভাড়া এবং Lisbon-Dhaka রুটেও ভালো দাম অফার করি। সেরা ভাড়া সাধারণত স্কুল ছুটির বাইরে এবং সপ্তাহান্তের বাইরে পাওয়া যায়। আপনার গন্তব্য, শহর, তারিখ ও যাত্রীর সংখ্যা জানান।"
    }
  },
  {
    name: 'bus',
    priority: 60,
    handoff: false,
    tests: [
      /\bbus\b/, /\btrain\b/, /\bfaites vous (?:le )?bus\b/, /\bdo you (?:offer|have) bus\b/,
      // Banglish / Bengali
      /\bbus ache\b/, /\bbus ticket\b/, /\btrain ache\b/
    ],
    response: {
      fr: "Non, AMI Voyages propose uniquement des voyages aériens. Nous sommes spécialisés dans les destinations d'Asie du Sud (Bangladesh, Inde, Sri Lanka) et d'Afrique subsaharienne (Mali, Sénégal, Guinée, RDC).",
      en: "No, AMI Voyages only offers air travel. We specialize in South Asian destinations (Bangladesh, India, Sri Lanka) and sub-Saharan African destinations (Mali, Senegal, Guinea, DRC).",
      bn: "না, AMI Voyages শুধুমাত্র বিমান ভ্রমণ অফার করে। আমরা দক্ষিণ এশিয়া (বাংলাদেশ, ভারত, শ্রীলঙ্কা) এবং সাহারার দক্ষিণের আফ্রিকার (মালি, সেনেগাল, গিনি, DRC) গন্তব্যে বিশেষজ্ঞ।"
    }
  },
  {
    name: 'appel_non_repondu',
    priority: 58,
    handoff: false,
    tests: [
      /\bvous ne repondez pas\b/, /\bje n arrive pas a vous joindre\b/,
      /\bligne(?:s)? (?:est |sont )?occupe\b/, /\bje vous ai appele\b/,
      /\bappel manque\b/, /\bpersonne ne repond\b/, /\bca repond pas\b/,
      /\byou don t answer\b/, /\bi can t reach you\b/, /\bmissed call\b/,
      /\bno (?:one|body) answering\b/,
      // Banglish / Bengali
      /\breceive korina\b/, /\bfone dhoren na\b/, /\bphone receive hoyna\b/,
      /\bcall receive hoilo na\b/, /\bcall korechi\b/,
      /ফোন ধরছেন না/, /কল রিসিভ হয়নি/
    ],
    response: {
      fr: "Nous sommes désolés si vous n'avez pas reçu de réponse rapide. Pouvez-vous nous préciser votre demande ou nous laisser votre numéro ? Un conseiller AMI Voyages vous reviendra dès que possible.",
      en: "We are sorry if you didn't receive a quick response. Could you clarify your request or leave us your number? An AMI Voyages advisor will get back to you as soon as possible.",
      bn: "দ্রুত সাড়া না পেলে আমরা দুঃখিত। আপনার অনুরোধটি বিস্তারিত জানান অথবা আপনার নম্বরটি রেখে যান। AMI Voyages-এর একজন উপদেষ্টা যত তাড়াতাড়ি সম্ভব আপনার সাথে যোগাযোগ করবেন।"
    }
  },
  {
    name: 'agent_disponible',
    priority: 56,
    handoff: false,
    tests: [
      /\bagent disponible\b/, /\bconseiller disponible\b/, /\best quelqu un disponible\b/,
      /\bagent available\b/, /\bis (?:someone|anyone) available\b/,
      // Banglish / Bengali
      /\bagent free ache\b/, /\bkeu available\b/, /\bagent ache\b/,
      /এজেন্ট আছেন/, /কেউ কি আছেন/
    ],
    response: {
      fr: "Nos conseillers sont disponibles selon leur planning. Nous faisons de notre mieux pour répondre rapidement pendant les horaires d'ouverture. En dehors de ces horaires, vous pouvez déjà nous laisser votre demande ici sur WhatsApp.",
      en: "Our advisors are available according to their schedule. We do our best to respond quickly during opening hours. Outside these hours, you can leave your request here on WhatsApp.",
      bn: "আমাদের উপদেষ্টারা তাদের সময়সূচি অনুযায়ী উপলব্ধ। আমরা খোলার সময়ে যত দ্রুত সম্ভব সাড়া দেওয়ার চেষ্টা করি। অন্য সময়ে, আপনি WhatsApp-এ আপনার অনুরোধ রেখে যেতে পারেন।"
    }
  },
  {
    name: 'delai_reponse',
    priority: 54,
    handoff: false,
    tests: [
      /\bdelai de reponse\b/, /\bcombien de temps pour repondre\b/,
      /\ben combien de temps\b/, /\bresponse time\b/, /\bhow long to respond\b/,
      // Banglish / Bengali
      /\bkoto shomoy lage\b/, /\bkobe uttor pabo\b/, /\bkob reply pabo\b/,
      /কতক্ষণ লাগে/, /কখন উত্তর পাব/
    ],
    response: {
      fr: "Nous faisons de notre mieux pour répondre dans les meilleurs délais pendant les horaires d'ouverture. En dehors de ces horaires, vous pouvez déjà nous laisser votre demande ici sur WhatsApp.",
      en: "We do our best to respond as quickly as possible during opening hours. Outside these hours, you can leave your request here on WhatsApp.",
      bn: "আমরা খোলার সময়ে যত দ্রুত সম্ভব সাড়া দেওয়ার চেষ্টা করি। অন্য সময়ে, আপনি এখানে WhatsApp-এ আপনার অনুরোধ রেখে যেতে পারেন।"
    }
  },
  {
    name: 'duree_minimum',
    priority: 50,
    handoff: false,
    tests: [
      /\bduree minimum\b/, /\bminimum de jours\b/, /\bsejour minimum\b/,
      /\bminimum stay\b/, /\bminimum days\b/,
      // Banglish / Bengali
      /\bkoto din minimum\b/, /\bminimum koto din thakte hobe\b/,
      /সর্বনিম্ন কতদিন/
    ],
    response: {
      fr: "En Asie, le séjour minimum est généralement de 5 à 7 jours. En Afrique, c'est généralement 3 jours, selon la compagnie aérienne.",
      en: "In Asia, the minimum stay is generally 5 to 7 days. In Africa, it's generally 3 days, depending on the airline.",
      bn: "এশিয়ায়, সর্বনিম্ন থাকা সাধারণত ৫ থেকে ৭ দিন। আফ্রিকায়, এটি সাধারণত ৩ দিন, এয়ারলাইনের উপর নির্ভর করে।"
    }
  },
  {
    name: 'remerciement',
    priority: 45,
    handoff: false,
    tests: [
      /\bmerci\b/, /\bmercii\b/, /\bmercie\b/, /\bmrc\b/, /\bmrc bcp\b/,
      /\bthank you\b/, /\bthanks\b/, /\bthx\b/, /\bty\b/,
      // Banglish / Bengali
      /\bdonnobad\b/, /\bdhonnobad\b/, /\bshukriya\b/, /\bthank u\b/,
      /ধন্যবাদ/, /শুক্রিয়া/
    ],
    response: {
      fr: "Avec plaisir. Je reste à votre disposition pour votre voyage.",
      en: "You're welcome. I remain available to help with your trip.",
      bn: "আপনার স্বাগত। আপনার ভ্রমণে সহায়তার জন্য আমি সর্বদা প্রস্তুত।"
    }
  },
  {
    name: 'ca_va',
    priority: 43,
    handoff: false,
    tests: [
      /\bca va\b/, /\bsa va\b/, /\bcava\b/, /\bcomment ca va\b/, /\bcomment allez vous\b/,
      /\bcomment vas tu\b/, /\bquoi de neuf\b/, /\bhow are you\b/, /\bhows it going\b/,
      /\bhow are u\b/, /\bhow r u\b/,
      // Banglish / Bengali
      /\bkemon achen\b/, /\bkemon acho\b/, /\bkemon aso\b/, /\bki obostha\b/,
      /কেমন আছেন/, /কি অবস্থা/
    ],
    response: {
      fr: "Très bien, merci ! Bienvenue chez AMI Voyages, spécialisée dans les vols vers l'Asie du Sud et l'Afrique subsaharienne. En quoi puis-je vous aider ?",
      en: "Very well, thank you! Welcome to AMI Voyages, specialized in flights to South Asia and sub-Saharan Africa. How can I help you?",
      bn: "অনেক ভালো, ধন্যবাদ! AMI Voyages-এ আপনাকে স্বাগতম, আমরা দক্ষিণ এশিয়া ও সাহারার দক্ষিণের আফ্রিকায় ফ্লাইটে বিশেষজ্ঞ। আমি কীভাবে আপনাকে সাহায্য করতে পারি?"
    }
  },
  {
    name: 'salutation',
    priority: 41,
    handoff: false,
    tests: [
      /\bbonjour\b/, /\bsalut\b/, /\bcoucou\b/, /\bbonsoir\b/,
      /\bhello\b/, /\bhi\b/, /\bhey\b/, /\bgood morning\b/, /\bgood afternoon\b/, /\bgood evening\b/,
      // Banglish / Bengali
      /\bnamaskar\b/, /\bnamasthe\b/, /\bnamaste\b/,
      /নমস্কার/, /হ্যালো/
    ],
    response: {
      fr: "Bonjour, bienvenue chez AMI Voyages. Nous sommes spécialisés dans les vols vers l'Asie du Sud et l'Afrique subsaharienne. En quoi puis-je vous aider ?",
      en: "Hello, welcome to AMI Voyages. We specialize in flights to South Asia and sub-Saharan Africa. How can I help you?",
      bn: "হ্যালো, AMI Voyages-এ আপনাকে স্বাগতম। আমরা দক্ষিণ এশিয়া ও সাহারার দক্ষিণের আফ্রিকায় ফ্লাইটে বিশেষজ্ঞ। আমি কীভাবে আপনাকে সাহায্য করতে পারি?"
    }
  },
  {
    name: 'salam',
    priority: 40,
    handoff: false,
    tests: [
      /\bsalam\b/, /\bsalam aleykoum\b/, /\bsalamaleykoum\b/, /\bsalamalaykoum\b/,
      /\bassalamoualaykoum\b/, /\bassalamualaikum\b/, /\bassalamu alaikum\b/,
      // Bengali script
      /আসসালামু আলাইকুম/, /সালাম/
    ],
    response: {
      fr: "Walaikum salam, bienvenue chez AMI Voyages. Nous sommes spécialisés dans les vols vers l'Asie du Sud et l'Afrique subsaharienne. En quoi puis-je vous aider ?",
      en: "Walaikum assalam, welcome to AMI Voyages. We specialize in flights to South Asia and sub-Saharan Africa. How can I help you?",
      bn: "ওয়ালাইকুম আসালাম, AMI Voyages-এ আপনাকে স্বাগতম। আমরা দক্ষিণ এশিয়া ও সাহারার দক্ষিণের আফ্রিকায় ফ্লাইটে বিশেষজ্ঞ। আমি কীভাবে আপনাকে সাহায্য করতে পারি?"
    }
  },
  {
    name: 'au_revoir',
    priority: 38,
    handoff: false,
    tests: [
      /\bau revoir\b/, /\ba bientot\b/, /\bbonne journee\b/, /\bbonne soiree\b/,
      /\ba plus\b/, /\bbye\b/, /\bgoodbye\b/, /\bsee you\b/, /\bsee ya\b/, /\bcya\b/,
      // Banglish / Bengali
      /\bbiday\b/, /\bbiday nii\b/, /\bshubie\b/, /\bfir milenge\b/,
      /বিদায়/, /আল্লাহ হাফেজ/
    ],
    response: {
      fr: "Merci pour votre message. À bientôt chez AMI Voyages.",
      en: "Thank you for your message. See you soon at AMI Voyages.",
      bn: "আপনার বার্তার জন্য ধন্যবাদ। AMI Voyages-এ শীঘ্রই আপনাকে দেখব।"
    }
  }
].sort((a, b) => b.priority - a.priority);
 
// =====================================================================
// DETECTION D'INTENTION
// =====================================================================
function detectIntent(message = '') {
  const normalizedMessage = normalizeText(message);
  const rawMessage = String(message || '');
 
  for (const intent of INTENTS) {
    try {
      const matched = intent.tests.some((regex) => {
        if (hasBengaliScript(rawMessage)) {
          return regex.test(rawMessage) || regex.test(normalizedMessage);
        }
        return regex.test(normalizedMessage);
      });
      if (matched) return intent;
    } catch (e) {
      // ignorer les erreurs de regex
    }
  }
  return null;
}
 
// =====================================================================
// GENERATION DE REPONSE
// =====================================================================
async function generateTravelReply(messageText, sender) {
  const safeText = String(messageText || '').trim();
  if (!safeText) {
    const lang = 'fr';
    return t(lang, 'empty_message');
  }
 
  const lang = detectLanguage(safeText);
  const { greeting, rest, isOnlyGreeting } = parseLeadingGreeting(safeText, lang);
  const cleanText = rest || safeText;
 
  if (isOnlyGreeting) {
    const intent = detectIntent(safeText);
    const responseText = intent
      ? (intent.response?.[lang] || intent.response?.fr || '')
      : t(lang, 'empty_message');
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
        const messages = {
          fr: `Super, nous pouvons vous aider à organiser votre voyage vers ${destination}. Merci d'indiquer votre ville de départ, vos dates de départ et de retour, et le nombre de passagers. Un conseiller AMI Voyages prendra ensuite le relais.`,
          en: `Great, we can help you organize your trip to ${destination}. Please tell us your departure city, departure and return dates, and the number of passengers. An AMI Voyages advisor will then assist you.`,
          bn: `চমৎকার, আমরা আপনাকে ${destination}-এ ভ্রমণ পরিকল্পনায় সাহায্য করতে পারি। অনুগ্রহ করে আপনার ছাড়ার শহর, যাওয়া ও আসার তারিখ এবং যাত্রীর সংখ্যা জানান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।`
        };
        if (intent.handoff && sender) {
          saveSession(sender, { awaitingContact: true, intent: intent.name, timestamp: Date.now(), lang });
        }
        return prefixResponse(greeting, messages[lang] || messages.fr);
      }
    }
 
    if (intent.handoff && sender) {
      saveSession(sender, { awaitingContact: true, intent: intent.name, timestamp: Date.now(), lang });
    }
 
    const responseText = intent.response?.[lang] || intent.response?.fr || t(lang, 'unknown_message');
    return prefixResponse(greeting, responseText);
  }
 
  return prefixResponse(greeting, t(lang, 'unknown_message'));
}
 
async function handleTextMessage(text, sender) {
  return await generateTravelReply(text, sender);
}
 
// =====================================================================
// AUDIO
// =====================================================================
async function transcribeAudio(filePath) {
  // TODO : intégrer un vrai service de transcription (ex: OpenAI Whisper API)
  return '';
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
    const mediaId = media?.id || null;
    if (!mediaId) return t('fr', 'unsupported_media');
 
    const mediaUrlResp = await axios.get(`https://graph.facebook.com/v17.0/${mediaId}`, {
      params: { access_token: process.env.WHATSAPP_TOKEN }
    });
    const mediaUrl = mediaUrlResp.data?.url;
    if (!mediaUrl) return t('fr', 'unsupported_media');
 
    const tmpPath = `./tmp_audio_${Date.now()}.ogg`;
    await downloadFile(mediaUrl, tmpPath);
    const transcription = await transcribeAudio(tmpPath);
 
    try { await fs.promises.unlink(tmpPath); } catch (e) { /* ignorer */ }
 
    if (!transcription || transcription === '') {
      return t('fr', 'no_transcription');
    }
    return await generateTravelReply(transcription, sender);
  } catch (e) {
    console.warn('[AUDIO] Erreur :', e.message || e);
    return t('fr', 'audio_error');
  }
}
 
// =====================================================================
// ENVOI DE MESSAGE WHATSAPP
// =====================================================================
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
    console.log('[WA] Message envoyé :', response.data.messages?.[0]?.id || '(pas d\'id)');
  } catch (error) {
    console.error('[WA] Erreur d\'envoi :', error.response?.data || error.message || error);
    throw error;
  }
}
 
// =====================================================================
// ROUTES
// =====================================================================
app.get('/', (req, res) => {
  res.send("WhatIA (AMI Voyages) est en cours d'exécution.");
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
  return res.status(403).send('Échec de la vérification du webhook');
});
 
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
 
    if (
      body.object !== 'whatsapp_business_account' ||
      !body.entry?.[0]?.changes?.[0]?.value
    ) {
      return res.status(200).send('Ignoré : événement non WhatsApp');
    }
 
    const value = body.entry[0].changes[0].value;
    const messages = value.messages || [];
    if (!messages.length) return res.status(200).send('Aucun message');
 
    const message = messages[0];
    const messageId = message?.id || null;
 
    if (messageId && isMessageProcessed(messageId)) {
      console.log('[WEBHOOK] Doublon ignoré :', messageId);
      return res.status(200).send('Doublon ignoré');
    }
    markMessageProcessed(messageId);
 
    const sender = message.from;
    let replyText = '';
 
    if (message.type === 'text' && message.text?.body) {
      console.log('[WEBHOOK] Message texte reçu de', sender, ':', message.text.body);
      replyText = await handleTextMessage(message.text.body, sender);
    } else if (['audio', 'voice'].includes(message.type)) {
      console.log('[WEBHOOK] Message audio reçu de', sender);
      replyText = await handleAudioMessage(message, sender);
    } else if (['sticker', 'image', 'video', 'document', 'location', 'contacts'].includes(message.type)) {
      replyText = t('fr', 'unsupported_media');
    } else {
      replyText = t('fr', 'unknown_message');
    }
 
    await sendWhatsAppText(sender, replyText);
    return res.status(200).send('OK');
  } catch (error) {
    console.error('[WEBHOOK] Erreur de traitement :', error);
    return res.status(500).send('Erreur serveur');
  }
});
 
app.listen(PORT, () => {
  console.log(`WhatIA AMI Voyages en écoute sur le port ${PORT}`);
});