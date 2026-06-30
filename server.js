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
    .replace(/[^\w\s\u0900-\u097F\u0980-\u09FF\u0B80-\u0BFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const greetingFixes = {
    bjr: 'bonjour',
    bnjr: 'bonjour',
    bjrr: 'bonjour',
    bonjor: 'bonjour',
    bonjou: 'bonjour',
    slt: 'salut',
    slm: 'salam',
    salamalaykoum: 'salam aleykoum',
    salamaleykoum: 'salam aleykoum',
    salamalaikoum: 'salam aleykoum',
    assalamoualaykoum: 'salam aleykoum',
    assalamoualaikoum: 'salam aleykoum',
    assalamualaikum: 'salam aleykoum',
    assalamualaykum: 'salam aleykoum',
    asalamualaikum: 'salam aleykoum'
  };

  s = s.split(' ').map((w) => greetingFixes[w] || w).join(' ');
  return s;
}

// =====================================================================
// DETECTION DE LANGUE FR / EN / BN / HI / TA
// =====================================================================
function hasBengaliScript(text) {
  return /[\u0980-\u09FF]/.test(String(text || ''));
}

function hasDevanagariScript(text) {
  return /[\u0900-\u097F]/.test(String(text || ''));
}

function hasTamilScript(text) {
  return /[\u0B80-\u0BFF]/.test(String(text || ''));
}

const BANGLISH_WORDS = new Set([
  'ami', 'amar', 'amra', 'apni', 'apnar', 'ache', 'ase', 'ace', 'chai', 'chay',
  'lagbe', 'lagbey', 'jabo', 'zabo', 'jete', 'kotha', 'kothay', 'koto', 'coto',
  'kotho', 'taka', 'kobe', 'kokhon', 'khola', 'bolbo', 'bolte', 'bolun', 'korun',
  'diben', 'pathan', 'pathao', 'jamate', 'tiket', 'biket', 'biza', 'peyment',
  'buking', 'aijent', 'shathe', 'sathe', 'niyom', 'shomoy', 'somoy', 'manush',
  'manus', 'hoye', 'hoyeche', 'giyeche', 'geche', 'thakbe', 'ki', 'kta', 'den',
  'lage', 'lagbe', 'daam', 'khaber', 'shomossa', 'jiggesh'
]);

const HINDI_WORDS = new Set([
  'mujhe', 'mera', 'meri', 'mere', 'hum', 'hamara', 'hamari', 'aap', 'aapka',
  'aapki', 'yahan', 'wahan', 'kahan', 'kab', 'kaise', 'kyun', 'kitna', 'kitne',
  'chahiye', 'chahte', 'chahti', 'chahta', 'milega', 'milegi', 'bataiye', 'batao',
  'ticket', 'tikat', 'udaan', 'safar', 'yatra', 'jana', 'jaana', 'jane', 'jao',
  'paisa', 'paise', 'daam', 'kiraya', 'booking', 'bukking', 'passport', 'pasport',
  'agent', 'seva', 'madad', 'nahin', 'nahi', 'haan', 'accha', 'theek',
  'dhanyavad', 'shukriya', 'kal', 'aaj', 'parso', 'tarikh', 'samay', 'waqt',
  'namaste', 'namaskar', 'pranam', 'adaab'
]);

const TAMIL_WORDS = new Set([
  'enakku', 'naanum', 'naan', 'ungal', 'unkal', 'avar', 'ivan', 'ival',
  'enge', 'eppo', 'eppadi', 'enna', 'ethanai', 'evvalavu', 'vendum', 'venum',
  'thevai', 'illai', 'irukku', 'irukkum', 'ticket', 'payan', 'payanam', 'poga',
  'povathu', 'pogirom', 'vilai', 'kattanam', 'kasu', 'nanri', 'vanakkam',
  'vanakam', 'solvom', 'kelu', 'sollunga', 'passport', 'agent', 'aadharam'
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

  if (hasTamilScript(raw)) return 'ta';
  if (hasDevanagariScript(raw)) return 'hi';
  if (hasBengaliScript(raw)) return 'bn';

  const normalized = normalizeText(raw);
  const words = normalized.split(' ').filter(Boolean);

  let frCount = 0;
  let enCount = 0;
  let bnCount = 0;
  let hiCount = 0;
  let taCount = 0;

  for (const w of words) {
    if (BANGLISH_WORDS.has(w)) bnCount++;
    if (HINDI_WORDS.has(w)) hiCount++;
    if (TAMIL_WORDS.has(w)) taCount++;
    if (FRENCH_LANG_WORDS.has(w)) frCount++;
    if (ENGLISH_LANG_WORDS.has(w)) enCount++;
  }

  const max = Math.max(frCount, enCount, bnCount, hiCount, taCount);
  if (max === 0) return 'fr';
  if (taCount === max) return 'ta';
  if (hiCount === max) return 'hi';
  if (bnCount === max) return 'bn';
  if (enCount === max) return 'en';
  return 'fr';
}

// =====================================================================
// TEXTES SYSTEME — 5 LANGUES
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
  },
  hi: {
    unsupported_media: "क्षमा करें, मैं अभी इस प्रकार की फ़ाइल को संसाधित नहीं कर सकता। कृपया अपना अनुरोध लिखित रूप में बताएं।",
    handoff_ack: "आपकी जानकारी के लिए धन्यवाद। AMI Voyages का एक सलाहकार जल्द ही आपसे संपर्क करेगा।",
    no_transcription: "मैं आपका वॉइस संदेश समझ नहीं पाया। क्या आप इसे टेक्स्ट में लिख सकते हैं?",
    audio_error: "आपके वॉइस संदेश को प्रोसेस करने में कोई समस्या हुई। यदि आवश्यक हो तो एक सलाहकार मदद कर सकता है।",
    empty_message: "मैं सुन रहा हूँ। क्या आप अपनी आवश्यकता के बारे में और बता सकते हैं?",
    unknown_message: "मैं आपका अनुरोध पूरी तरह समझ नहीं पाया। AMI Voyages का एक सलाहकार आपकी मदद के लिए आगे आएगा।"
  },
  ta: {
    unsupported_media: "மன்னிக்கவும், இந்த வகை கோப்பை இப்போது செயலாக்க முடியாது. உங்கள் கோரிக்கையை எழுத்தில் தெரிவிக்கவும்.",
    handoff_ack: "இந்த தகவலுக்கு நன்றி. AMI Voyages-இன் ஒரு ஆலோசகர் விரைவில் உங்களை தொடர்பு கொள்வார்.",
    no_transcription: "உங்கள் குரல் செய்தியை புரிந்துகொள்ள முடியவில்லை. தயவுசெய்து அதை உரையாக எழுதுங்கள்.",
    audio_error: "உங்கள் குரல் செய்தியை செயலாக்குவதில் சிக்கல் ஏற்பட்டது. தேவைப்பட்டால் ஒரு ஆலோசகர் உதவுவார்.",
    empty_message: "நான் கேட்கிறேன். உங்களுக்கு என்ன தேவை என்று கொஞ்சம் விவரமாக சொல்லுங்கள்.",
    unknown_message: "உங்கள் கோரிக்கையை முழுமையாக புரிந்துகொள்ள முடியவில்லை. AMI Voyages-இன் ஒரு ஆலோசகர் உங்களுக்கு உதவுவார்."
  }
};

function t(lang = 'fr', key = '', vars = {}) {
  const text = TEXTS[lang]?.[key] || TEXTS.fr?.[key] || '';
  let result = text;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replaceAll(`{${k}}`, v);
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
  for (const b of blacklist) {
    if (s.includes(b)) return false;
  }
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
    /\bami\s+([a-z]{3,30})\s+(?:jete|jabo|zabo|jaite|jaibo)\s+chai\b/,
    /\b([a-z]{3,30})\s+jete\s+chai\b/,
    /\b([a-z]{3,30})\s+(?:ticket|tiket)\s+(?:lagbe|chai)\b/,
    /\b(?:mujhe|hume|humein)\s+([a-z]{3,30})\s+(?:jana|jaana)\s+(?:hai|he)\b/,
    /\b([a-z]{3,30})\s+(?:ka|ki|ke)\s+ticket\s+chahiye\b/,
    /\b([a-z]{3,30})\s+(?:jane|jaane)\s+(?:ka|ki)\s+(?:ticket|tikat)\b/,
    /\b([a-z]{3,30})\s+poga\s+(?:ticket|tiket)\s+(?:vendum|venum)\b/,
    /\b([a-z]{3,30})\s+(?:ku|ukku)\s+(?:ticket|tiket)\s+(?:vendum|venum)\b/
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
  } else if (lang === 'hi') {
    const rawHi = String(text || '');
    const matchDevanagari = rawHi.match(/^(?:नमस्ते|नमस्कार|सलाम|आदाब|प्रणाम)[,\s]*(.*)$/u);
    if (matchDevanagari) {
      const rest = String(matchDevanagari[1] || '').trim();
      return { greeting: 'नमस्ते', rest, isOnlyGreeting: rest.length === 0 };
    }
    const matchHiLatin = normalized.match(/^(?:namaste|namaskar|namasthe|salam|adaab|pranam)\b[\s,]*(.*)$/);
    if (matchHiLatin) {
      const rest = String(matchHiLatin[1] || '').trim();
      return { greeting: 'Namaste', rest, isOnlyGreeting: rest.length === 0 };
    }
    const matchHiHello = normalized.match(/^(?:hello|hi|hey)\b[\s,]*(.*)$/);
    if (matchHiHello) {
      const rest = String(matchHiHello[1] || '').trim();
      return { greeting: 'Hello', rest, isOnlyGreeting: rest.length === 0 };
    }
  } else if (lang === 'ta') {
    const rawTa = String(text || '');
    const matchTamilScript = rawTa.match(/^(?:வணக்கம்|நமஸ்காரம்|ஹலோ)[,\s]*(.*)$/u);
    if (matchTamilScript) {
      const rest = String(matchTamilScript[1] || '').trim();
      return { greeting: 'வணக்கம்', rest, isOnlyGreeting: rest.length === 0 };
    }
    const matchTaLatin = normalized.match(/^(?:vanakkam|vanakam|namaskar|namasthe|hello|hi|hey)\b[\s,]*(.*)$/);
    if (matchTaLatin) {
      const rest = String(matchTaLatin[1] || '').trim();
      return { greeting: 'Vanakkam', rest, isOnlyGreeting: rest.length === 0 };
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
// INTENTIONS
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
      /\bflight cancel\b/, /\bamar flight cancel\b/, /\bcancel ho(?:ye)?(?:che|gese|geche)?\b/,
      /\bflight bondho\b/, /\bflight deri\b/,
      /আমার ফ্লাইট ক্যান্সেল/, /ফ্লাইট বাতিল/, /ফ্লাইট দেরি/,
      /\bmeri flight cancel\b/, /\bflight cancel ho gayi\b/, /\bflight late hai\b/,
      /\bflight cancel kar di\b/, /\budaan cancel\b/,
      /मेरी फ्लाइट रद्द/, /फ्लाइट देरी/, /उड़ान रद्द/,
      /\ben flight cancel\b/, /\bflight late aaguthu\b/,
      /என் விமானம் ரத்து/, /விமானம் தாமதம்/
    ],
    response: {
      fr: "Nous sommes désolés pour la gêne occasionnée. Merci d'indiquer votre référence de dossier, votre numéro de téléphone et le nom du passager. Un conseiller AMI Voyages prendra votre dossier en charge dès que possible.",
      en: "We are sorry for the inconvenience. Please provide your booking reference, your phone number and the passenger's name. An AMI Voyages advisor will assist you as soon as possible.",
      bn: "অসুবিধার জন্য আমরা দুঃখিত। অনুগ্রহ করে আপনার বুকিং রেফারেন্স, ফোন নম্বর এবং যাত্রীর নাম জানান। AMI Voyages-এর একজন উপদেষ্টা যত তাড়াতাড়ি সম্ভব আপনার সাথে যোগাযোগ করবেন।",
      hi: "हम असुविधा के लिए क्षमाप्रार्थी हैं। कृपया अपना बुकिंग संदर्भ, फ़ोन नंबर और यात्री का नाम बताएं। AMI Voyages का एक सलाहकार जल्द से जल्द आपकी मदद करेगा।",
      ta: "தொந்தரவுக்கு மன்னிக்கவும். உங்கள் புக்கிங் குறிப்பு எண், தொலைபேசி எண் மற்றும் பயணியின் பெயர் தெரிவிக்கவும். AMI Voyages-இன் ஒரு ஆலோசகர் கூடிய விரைவில் உங்களுக்கு உதவுவார்."
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
      /\bflight confirm\b/, /\bamar flight confirmed\b/, /\bticket confirmed\b/,
      /\bconfirm hoye(?:che)?\b/, /\bconfirm ache\b/,
      /আমার ফ্লাইট কনফার্ম/, /টিকেট কনফার্ম/,
      /\bmera ticket confirm\b/, /\bflight confirm hai\b/, /\budaan ki pushthi\b/,
      /मेरा टिकट कन्फर्म/, /फ्लाइट की पुष्टि/,
      /\ben ticket confirm\b/,
      /என் டிக்கெட் உறுதி/, /விமானம் உறுதிப்படுத்தல்/
    ],
    response: {
      fr: "Merci de nous envoyer la référence de votre billet, votre numéro de billet ou la copie du passeport du passager. Un conseiller AMI Voyages prendra ensuite le relais. Vous pouvez aussi consulter le site de la compagnie aérienne.",
      en: "Please send us your ticket reference, ticket number or a copy of the passenger's passport. An AMI Voyages advisor will then assist you. You can also check the airline's website directly.",
      bn: "অনুগ্রহ করে আপনার টিকেট রেফারেন্স, টিকেট নম্বর বা যাত্রীর পাসপোর্টের কপি পাঠান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন। আপনি সরাসরি এয়ারলাইনের ওয়েবসাইটেও দেখতে পারেন।",
      hi: "कृपया अपना टिकट संदर्भ, टिकट नंबर या यात्री के पासपोर्ट की कॉपी भेजें। AMI Voyages का एक सलाहकार आपकी मदद करेगा। आप सीधे एयरलाइन की वेबसाइट भी देख सकते हैं।",
      ta: "உங்கள் டிக்கெட் குறிப்பு எண், டிக்கெட் எண் அல்லது பயணியின் பாஸ்போர்ட் நகல் அனுப்பவும். AMI Voyages-இன் ஒரு ஆலோசகர் உதவுவார். நீங்கள் நேரடியாக விமான நிறுவனத்தின் இணையதளத்தையும் பார்க்கலாம்."
    }
  },
  {
    name: 'annulation_billet',
    priority: 120,
    handoff: true,
    tests: [
      /\bannuler mon billet\b/, /\bje veux annuler\b/, /\bannulation\b/,
      /\bcancel my ticket\b/, /\bcancel my booking\b/, /\bi want to cancel\b/,
      /\bcancell?ation\b/,
      /\bticket cancel\b/, /\bbooking cancel\b/, /\bcancel korte chai\b/,
      /টিকেট বাতিল/, /বুকিং বাতিল/, /বাতিল করতে চাই/,
      /\bticket cancel karna\b/, /\bticket cancel karo\b/, /\bbooking cancel karni\b/,
      /टिकट रद्द करना/, /बुकिंग रद्द/,
      /\bticket cancel venum\b/,
      /டிக்கெட் ரத்து செய்ய/, /புக்கிங் ரத்து/
    ],
    response: {
      fr: "Les conditions d'annulation dépendent du billet réservé et des règles tarifaires de la compagnie. Si vous avez un dossier, merci de nous communiquer votre référence et le nom du passager. Un conseiller AMI Voyages prendra le relais.",
      en: "Cancellation conditions depend on the booked ticket and the airline's fare rules. If you have a booking, please send us your reference and the passenger's name. An AMI Voyages advisor will assist you.",
      bn: "বাতিলের শর্তাবলী বুক করা টিকেট এবং এয়ারলাইনের নিয়মের উপর নির্ভর করে। আপনার যদি বুকিং থাকে, অনুগ্রহ করে আপনার রেফারেন্স এবং যাত্রীর নাম জানান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।",
      hi: "रद्दीकरण की शर्तें बुक किए गए टिकट और एयरलाइन के किराया नियमों पर निर्भर करती हैं। यदि आपके पास बुकिंग है, तो कृपया अपना संदर्भ और यात्री का नाम बताएं। AMI Voyages का एक सलाहकार आपकी मदद करेगा।",
      ta: "ரத்து நிபந்தனைகள் பதிவு செய்யப்பட்ட டிக்கெட் மற்றும் விமான நிறுவனத்தின் கட்டண விதிகளை பொறுத்தது. புக்கிங் இருந்தால் உங்கள் குறிப்பு எண் மற்றும் பயணியின் பெயர் தெரிவிக்கவும். AMI Voyages-இன் ஒரு ஆலோசகர் உதவுவார்."
    }
  },
  {
    name: 'modification_billet',
    priority: 118,
    handoff: true,
    tests: [
      /\bmodifier mon billet\b/, /\bmodifier mon vol\b/, /\bchanger mon vol\b/,
      /\bchanger la date\b/, /\bchangement de date\b/, /\bmodif\b/,
      /\bmodify my (?:ticket|flight|booking)\b/, /\bchange my (?:ticket|flight|booking|date)\b/,
      /\bi want to change my flight\b/, /\bchange flight date\b/,
      /\bticket change\b/, /\bflight change\b/, /\bdate change korte\b/,
      /টিকেট পরিবর্তন/, /তারিখ পরিবর্তন/, /ফ্লাইট পরিবর্তন/,
      /\bticket badalna\b/, /\bticket change karna\b/, /\btarikh badalni\b/,
      /टिकट बदलना/, /तारीख बदलना/, /फ्लाइट बदलना/,
      /\bticket maatruvom\b/, /\bthethi maatruvom\b/,
      /டிக்கெட் மாற்றம்/, /தேதி மாற்றம்/
    ],
    response: {
      fr: "Une modification doit être vérifiée par un conseiller selon les conditions du billet. Merci d'indiquer votre référence de dossier et votre demande précise. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "A change needs to be verified by an advisor based on the ticket conditions. Please provide your booking reference and your specific request. An AMI Voyages advisor will then assist you.",
      bn: "পরিবর্তন করতে হলে টিকেটের শর্ত অনুযায়ী একজন উপদেষ্টার যাচাই করা দরকার। অনুগ্রহ করে আপনার বুকিং রেফারেন্স এবং নির্দিষ্ট অনুরোধটি জানান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।",
      hi: "बदलाव की जाँच टिकट की शर्तों के आधार पर एक सलाहकार द्वारा की जानी चाहिए। कृपया अपना बुकिंग संदर्भ और विशिष्ट अनुरोध बताएं। AMI Voyages का एक सलाहकार आपकी मदद करेगा।",
      ta: "மாற்றத்தை டிக்கெட் நிபந்தனைகளின் அடிப்படையில் ஒரு ஆலோசகர் சரிபார்க்க வேண்டும். உங்கள் புக்கிங் குறிப்பு எண் மற்றும் குறிப்பிட்ட கோரிக்கையை தெரிவிக்கவும். AMI Voyages-இன் ஒரு ஆலோசகர் உதவுவார்."
    }
  },
  {
    name: 'verification_dossier',
    priority: 115,
    handoff: true,
    tests: [
      /\bverifier mon dossier\b/, /\bverification de dossier\b/, /\bstatut de mon dossier\b/,
      /\bcheck my booking\b/, /\bverify my booking\b/, /\bbooking status\b/,
      /\bamar booking check\b/, /\bbooking check korun\b/, /\bdossier check\b/,
      /বুকিং চেক/, /আমার বুকিং চেক করুন/,
      /\bbooking check karo\b/, /\bbooking ki jaanch\b/, /\bmeri booking check\b/,
      /बुकिंग की जांच/, /मेरी बुकिंग चेक/,
      /\ben booking check pannu\b/,
      /என் புக்கிங் சரிபார்/, /பதிவு நிலை/
    ],
    response: {
      fr: "Oui, un conseiller peut vérifier votre dossier. Merci d'indiquer votre référence de dossier et le nom du passager. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Yes, an advisor can check your booking. Please provide your booking reference and the passenger's name. An AMI Voyages advisor will then assist you.",
      bn: "হ্যাঁ, একজন উপদেষ্টা আপনার বুকিং যাচাই করতে পারবেন। অনুগ্রহ করে আপনার বুকিং রেফারেন্স এবং যাত্রীর নাম জানান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।",
      hi: "हाँ, एक सलाहकार आपकी बुकिंग की जाँच कर सकता है। कृपया अपना बुकिंग संदर्भ और यात्री का नाम बताएं। AMI Voyages का एक सलाहकार आपकी मदद करेगा।",
      ta: "ஆம், ஒரு ஆலோசகர் உங்கள் புக்கிங்கை சரிபார்க்கலாம். உங்கள் புக்கிங் குறிப்பு எண் மற்றும் பயணியின் பெயர் தெரிவிக்கவும். AMI Voyages-இன் ஒரு ஆலோசகர் உதவுவார்."
    }
  },
  {
    name: 'prix_disponibilite',
    priority: 110,
    handoff: true,
    tests: [
      /\bprix\b/, /\btarif\b/, /\bcombien\b/, /\bdisponibilite\b/, /\bdispo\b/,
      /\bavez vous des places\b/, /\bplaces disponibles\b/,
      /\bhow much\b/, /\bcost\b/, /\bfare\b/, /\bavailability\b/, /\bseats available\b/,
      /\bprice koto\b/, /\brate koto\b/, /\bkoto taka\b/, /\bdaam koto\b/,
      /দাম কত/, /টিকেটের দাম/, /কত টাকা/, /সিট আছে/, /ফ্লাইট আছে/,
      /\bkitna paisa\b/, /\bkiraya kitna\b/, /\bticket kitne ka\b/, /\bseat available\b/,
      /टिकट कितने का/, /किराया कितना/, /सीट उपलब्ध/,
      /\bevvalavu vilai\b/, /\bticket vilai\b/, /\bseat irukka\b/,
      /டிக்கெட் விலை/, /கட்டணம் என்ன/, /இருக்கை உள்ளதா/
    ],
    response: {
      fr: "Les prix varient selon la destination, la date, la compagnie et les places disponibles. Merci d'indiquer : destination, ville de départ et de retour, dates, nombre de passagers et vos préférences (compagnie, vol direct ou prix le plus bas). Un conseiller AMI Voyages vous répondra.",
      en: "Prices vary by destination, date, airline and seat availability. Please tell us: your destination, departure and return city, dates, number of passengers and your preference (airline, direct flight or lowest price). An AMI Voyages advisor will assist you.",
      bn: "গন্তব্য, তারিখ, এয়ারলাইন ও আসনের উপর নির্ভর করে দাম পরিবর্তন হয়। অনুগ্রহ করে জানান: গন্তব্য, ছাড়ার ও ফেরার শহর, তারিখ, যাত্রীর সংখ্যা এবং আপনার পছন্দ (এয়ারলাইন, সরাসরি ফ্লাইট বা সর্বনিম্ন দাম)। AMI Voyages-এর একজন উপদেষ্টা আপনাকে জবাব দেবেন।",
      hi: "कीमतें गंतव्य, तारीख, एयरलाइन और उपलब्ध सीटों के अनुसार बदलती हैं। कृपया बताएं: गंतव्य, प्रस्थान और वापसी शहर, तारीखें, यात्रियों की संख्या और आपकी प्राथमिकता (एयरलाइन, सीधी उड़ान या सबसे कम कीमत)। AMI Voyages का एक सलाहकार आपको जवाब देगा।",
      ta: "விலைகள் இலக்கு, தேதி, விமான நிறுவனம் மற்றும் கிடைக்கும் இருக்கைகளைப் பொறுத்து மாறுபடும். தெரிவிக்கவும்: இலக்கு, புறப்பாடு மற்றும் திரும்பும் நகரம், தேதிகள், பயணிகள் எண்ணிக்கை மற்றும் உங்கள் விருப்பம் (விமான நிறுவனம், நேரடி விமானம் அல்லது குறைந்த விலை). AMI Voyages-இன் ஒரு ஆலோசகர் பதிலளிப்பார்."
    }
  },
  {
    name: 'devis',
    priority: 108,
    handoff: true,
    tests: [
      /\bdevis\b/, /\bje veux un devis\b/, /\bbesoin de devis\b/,
      /\bquote\b/, /\bi want a quote\b/, /\bi need a quote\b/,
      /\bquote chai\b/, /\bestimate lagbe\b/, /কোটেশন/, /দাম জানতে চাই/,
      /\bquote chahiye\b/, /\bestimate chahiye\b/, /कोटेशन चाहिए/,
      /\bquote vendum\b/, /\bestimate vendum\b/, /மேற்கோள் வேண்டும்/
    ],
    response: {
      fr: "Oui, nous pouvons vous faire un devis. Merci d'indiquer : destination, ville de départ et de retour, dates, nombre de passagers et votre numéro de téléphone. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Yes, we can provide a quote. Please provide: your destination, departure and return city, dates, number of passengers and your phone number. An AMI Voyages advisor will then assist you.",
      bn: "হ্যাঁ, আমরা আপনাকে একটি কোটেশন দিতে পারি। অনুগ্রহ করে জানান: গন্তব্য, ছাড়ার ও ফেরার শহর, তারিখ, যাত্রীর সংখ্যা এবং আপনার ফোন নম্বর। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।",
      hi: "हाँ, हम आपको एक कोटेशन दे सकते हैं। कृपया बताएं: गंतव्य, प्रस्थान और वापसी शहर, तारीखें, यात्रियों की संख्या और आपका फ़ोन नंबर। AMI Voyages का एक सलाहकार आपकी मदद करेगा।",
      ta: "ஆம், நாங்கள் மேற்கோள் கொடுக்கலாம். தெரிவிக்கவும்: இலக்கு, புறப்பாடு மற்றும் திரும்பும் நகரம், தேதிகள், பயணிகள் எண்ணிக்கை மற்றும் உங்கள் தொலைபேசி எண். AMI Voyages-இன் ஒரு ஆலோசகர் உதவுவார்."
    }
  },
  {
    name: 'paiement_conditions',
    priority: 106,
    handoff: true,
    tests: [
      /\bmoyens de paiement\b/, /\bconditions de paiement\b/, /\bcomment payer\b/,
      /\bpayment method\b/, /\bpayment options?\b/, /\bhow do i pay\b/,
      /\bpayment kivabe\b/, /পেমেন্টের নিয়ম/, /কিভাবে পেমেন্ট করব/,
      /\bbhugtan kaise kare\b/, /भुगतान कैसे करें/, /पेमेंट के तरीके/,
      /\bpayment eppadi\b/, /கட்டணம் எப்படி/, /பணம் செலுத்தும் முறை/
    ],
    response: {
      fr: "Nous acceptons les virements bancaires, les espèces, les chèques ANCV et chèques-vacances / Connect. Un lien de paiement en ligne peut aussi être envoyé. Un paiement en plusieurs fois peut être possible, sous conditions.",
      en: "We accept bank transfers, cash, ANCV vouchers and holiday vouchers / Connect. An online payment link can also be sent. Payment in installments may be possible under certain conditions.",
      bn: "আমরা ব্যাংক ট্রান্সফার, নগদ, ANCV ভাউচার এবং ছুটির ভাউচার গ্রহণ করি। অনলাইন পেমেন্ট লিঙ্কও পাঠানো যেতে পারে। নির্দিষ্ট শর্তে কিস্তিতে পেমেন্টও সম্ভব হতে পারে।",
      hi: "हम बैंक ट्रांसफर, नकद, ANCV वाउचर और छुट्टी वाउचर / Connect स्वीकार करते हैं। एक ऑनलाइन पेमेंट लिंक भी भेजा जा सकता है। कुछ शर्तों के तहत किस्तों में भुगतान भी संभव हो सकता है।",
      ta: "வங்கி பரிமாற்றம், பணம், ANCV வாட்சர்கள் மற்றும் விடுமுறை வாட்சர்கள் / Connect ஆகியவற்றை ஏற்கிறோம். ஆன்லைன் பேமண்ட் இணைப்பும் அனுப்பலாம். சில நிபந்தனைகளின் கீழ் தவணைகளில் பணம் செலுத்துவதும் சாத்தியமாகும்."
    }
  },
  {
    name: 'lien_paiement',
    priority: 105,
    handoff: true,
    tests: [
      /\blien de paiement\b/, /\benvoyer (?:un |le )?lien de paiement\b/,
      /\bpayment link\b/, /\bsend (?:me )?(?:a |the )?payment link\b/,
      /\bpayment link pathan\b/, /পেমেন্ট লিংক পাঠান/,
      /\bpayment link bhejo\b/, /पेमेंट लिंक भेजो/,
      /\bpayment link anuppu\b/, /பேமண்ட் இணைப்பு அனுப்பவும்/
    ],
    response: {
      fr: "Merci de nous envoyer votre facture d'achat ou, à défaut, une copie du passeport du passager. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Please send us your invoice or, failing that, a copy of the passenger's passport. An AMI Voyages advisor will then assist you.",
      bn: "অনুগ্রহ করে আপনার চালান বা যাত্রীর পাসপোর্টের কপি পাঠান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।",
      hi: "कृपया अपना चालान या यात्री के पासपोर्ट की कॉपी भेजें। AMI Voyages का एक सलाहकार आपकी मदद करेगा।",
      ta: "உங்கள் இன்வாய்ஸ் அல்லது பயணியின் பாஸ்போர்ட் நகல் அனுப்பவும். AMI Voyages-இன் ஒரு ஆலோசகர் உதவுவார்."
    }
  },
  {
    name: 'visa',
    priority: 102,
    handoff: true,
    tests: [
      /\bvisa\b/, /\bviza\b/, /\bdemande de visa\b/, /\bvisa for\b/, /\bvisa application\b/,
      /\bvisa lagbe\b/, /ভিসা লাগবে/, /ভিসার জন্য/,
      /\bvisa chahiye\b/, /\bvisa ke liye\b/, /वीज़ा चाहिए/, /वीज़ा आवेदन/,
      /\bvisa vendum\b/, /\bvisa apply\b/, /விசா வேண்டும்/
    ],
    response: {
      fr: "Nous proposons une assistance visa pour certaines destinations uniquement. Indiquez-nous votre destination et votre nationalité afin de vérifier si nous pouvons vous aider. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "We offer visa assistance for certain destinations only. Please tell us your destination and nationality so we can check if we can help. An AMI Voyages advisor will then assist you.",
      bn: "আমরা শুধুমাত্র কিছু নির্দিষ্ট গন্তব্যের জন্য ভিসা সহায়তা প্রদান করি। অনুগ্রহ করে আপনার গন্তব্য এবং জাতীয়তা জানান যাতে আমরা সাহায্য করতে পারি কিনা তা যাচাই করতে পারি। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।",
      hi: "हम केवल कुछ गंतव्यों के लिए वीज़ा सहायता प्रदान करते हैं। कृपया अपना गंतव्य और राष्ट्रीयता बताएं ताकि हम जाँच कर सकें कि हम मदद कर सकते हैं या नहीं। AMI Voyages का एक सलाहकार आपकी मदद करेगा।",
      ta: "சில இலக்குகளுக்கு மட்டுமே விசா உதவி வழங்குகிறோம். நாங்கள் உதவ முடியுமா என்று சரிபார்க்க உங்கள் இலக்கு மற்றும் தேசியத்தை தெரிவிக்கவும். AMI Voyages-இன் ஒரு ஆலோசகர் உதவுவார்."
    }
  },
  {
    name: 'documents_voyage',
    priority: 100,
    handoff: true,
    tests: [
      /\bdocuments? pour voyager\b/, /\bdocuments? requis\b/, /\bquels? documents\b/,
      /\btravel documents\b/, /\brequired documents\b/, /\bwhat documents\b/,
      /\bki document lagbe\b/, /কি ডকুমেন্ট লাগবে/, /ডকুমেন্টের তালিকা/,
      /\bdocuments chahiye\b/, /दस्तावेज़/, /कौन से दस्तावेज/,
      /\bdocument venum\b/, /எந்த ஆவணங்கள்/, /பயண ஆவணங்கள்/
    ],
    response: {
      fr: "Les documents nécessaires dépendent de la destination, de votre nationalité et du type de voyage. Indiquez-nous ces informations afin que nous puissions vous orienter. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Required documents depend on the destination, your nationality and the type of trip. Please tell us these details so we can guide you. An AMI Voyages advisor will then assist you.",
      bn: "প্রয়োজনীয় নথি গন্তব্য, জাতীয়তা এবং ভ্রমণের ধরন অনুযায়ী নির্ভর করে। এই তথ্যগুলো জানান যাতে আমরা আপনাকে সঠিকভাবে দিকনির্দেশনা দিতে পারি। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।",
      hi: "आवश्यक दस्तावेज़ गंतव्य, आपकी राष्ट्रीयता और यात्रा के प्रकार पर निर्भर करते हैं। कृपया ये विवरण बताएं ताकि हम आपको मार्गदर्शन दे सकें। AMI Voyages का एक सलाहकार आपकी मदद करेगा।",
      ta: "தேவையான ஆவணங்கள் இலக்கு, உங்கள் தேசியம் மற்றும் பயண வகையைப் பொறுத்தது. இந்த விவரங்களை தெரிவிக்கவும், அதன்படி நாங்கள் வழிகாட்டலாம். AMI Voyages-இன் ஒரு ஆலோசகர் உதவுவார்."
    }
  },
  {
    name: 'passeport',
    priority: 98,
    handoff: true,
    tests: [
      /\bpasseport\b/, /\bpassport\b/, /\bpassport valid\b/, /\bvalidity\b/,
      /\bpassport lagbe\b/, /পাসপোর্ট/, /মেয়াদ/,
      /\bpassport valid hai\b/, /पासपोर्ट/, /वैधता/,
      /\bpassport irukka\b/, /பாஸ்போர்ட்/, /செல்லுபடியாகும்/
    ],
    response: {
      fr: "La durée de validité requise pour le passeport dépend de la destination, souvent 6 mois après la date de retour. Indiquez-nous votre destination et la date d'expiration de votre passeport afin que nous puissions vérifier. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "The required passport validity depends on the destination, often 6 months after the return date. Please tell us your destination and your passport's expiry date so we can check. An AMI Voyages advisor will then assist you.",
      bn: "পাসপোর্টের প্রয়োজনীয় মেয়াদ গন্তব্যের উপর নির্ভর করে, সাধারণত ফেরার তারিখের পর ৬ মাস। আপনার গন্তব্য এবং পাসপোর্টের মেয়াদোত্তীর্ণের তারিখ জানান, যাতে আমরা যাচাই করতে পারি। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।",
      hi: "पासपोर्ट की आवश्यक वैधता गंतव्य पर निर्भर करती है, अक्सर वापसी की तारीख के बाद 6 महीने। कृपया अपना गंतव्य और पासपोर्ट की समाप्ति तिथि बताएं ताकि हम जाँच कर सकें। AMI Voyages का एक सलाहकार आपकी मदद करेगा।",
      ta: "பாஸ்போர்ட் செல்லுபடியாகும் காலம் இலக்கைப் பொறுத்தது, பொதுவாக திரும்பும் தேதிக்குப் பிறகு 6 மாதங்கள். உங்கள் இலக்கு மற்றும் பாஸ்போர்ட் காலாவதி தேதியை தெரிவிக்கவும். AMI Voyages-இன் ஒரு ஆலோசகர் உதவுவார்."
    }
  },
  {
    name: 'omra_hajj',
    priority: 96,
    handoff: true,
    tests: [
      /\bomra\b/, /\bumrah\b/, /\bhajj\b/,
      /\bomrah korte chai\b/, /ওমরা/, /হজ্জ/,
      /\bumrah jana hai\b/, /उमरा/, /हज/,
      /\bumrah venum\b/, /உம்ரா/, /ஹஜ்/
    ],
    response: {
      fr: "Oui, nous pouvons vous accompagner pour les voyages omra et hajj selon la période et les disponibilités. Indiquez-nous votre destination, vos villes de départ et de retour, vos dates et le nombre de passagers. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Yes, we can assist you with Umrah and Hajj trips depending on the period and availability. Please tell us your destination, departure and return city, dates and the number of passengers. An AMI Voyages advisor will then assist you.",
      bn: "হ্যাঁ, সময় ও প্রাপ্যতার ভিত্তিতে আমরা ওমরা ও হজ্জ ভ্রমণে সহায়তা করতে পারি। অনুগ্রহ করে আপনার গন্তব্য, যাত্রার শহর, ফেরার শহর, তারিখ এবং যাত্রীর সংখ্যা জানান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।",
      hi: "हाँ, हम अवधि और उपलब्धता के अनुसार उमरा और हज यात्रा में आपकी सहायता कर सकते हैं। कृपया अपना गंतव्य, प्रस्थान और वापसी शहर, तारीखें और यात्रियों की संख्या बताएं। AMI Voyages का एक सलाहकार आपकी मदद करेगा।",
      ta: "ஆம், காலநிலை மற்றும் கிடைப்பதைக் கருத்தில் கொண்டு உம்ரா மற்றும் ஹஜ் பயணங்களுக்கு உதவலாம். உங்கள் இலக்கு, புறப்பாடு மற்றும் திரும்பும் நகரம், தேதிகள் மற்றும் பயணிகள் எண்ணிக்கை தெரிவிக்கவும். AMI Voyages-இன் ஒரு ஆலோசகர் உதவுவார்."
    }
  },
  {
    name: 'grossesse',
    priority: 95,
    handoff: true,
    tests: [
      /\benceinte\b/, /\bgrossesse\b/, /\bpregnant\b/, /\bpregnancy\b/,
      /\bgorvoboti\b/, /গর্ভবতী/,
      /\bgarbhavati\b/, /गर्भवती/,
      /\bkarppini\b/, /கர்ப்பிணி/
    ],
    response: {
      fr: "Les femmes enceintes peuvent généralement voyager jusqu'à 6 mois. Au-delà, une autorisation médicale est requise, sous réserve d'acceptation par la compagnie et les services aéroportuaires. Consultez aussi votre médecin.",
      en: "Pregnant women can generally travel up to 6 months. Beyond that, a medical authorization is required, subject to acceptance by the airline and airport services. We also recommend consulting your doctor.",
      bn: "গর্ভবতী নারীরা সাধারণত ৬ মাস পর্যন্ত ভ্রমণ করতে পারেন। এর পর চিকিৎসকের অনুমতি প্রয়োজন হতে পারে, যা এয়ারলাইন ও বিমানবন্দর কর্তৃপক্ষের অনুমোদনের উপর নির্ভর করে। চিকিৎসকের পরামর্শ নিন।",
      hi: "गर्भवती महिलाएँ सामान्यतः 6 महीने तक यात्रा कर सकती हैं। उसके बाद चिकित्सकीय अनुमति की आवश्यकता हो सकती है, जो एयरलाइन और एयरपोर्ट सेवाओं की स्वीकृति पर निर्भर करेगी। अपने डॉक्टर से भी सलाह लें।",
      ta: "கர்ப்பிணிப் பெண்கள் பொதுவாக 6 மாதம் வரை பயணம் செய்யலாம். அதற்குப் பிறகு மருத்துவ அனுமதி தேவைப்படலாம்; அது விமான நிறுவனம் மற்றும் விமான நிலைய சேவைகளின் ஒப்புதலைப் பொறுத்தது. உங்கள் மருத்துவரையும் அணுகவும்."
    }
  },
  {
    name: 'bebe_tarif',
    priority: 94,
    handoff: false,
    tests: [
      /\btarif.*bebe\b/, /\bbebe\b/, /\bbaby fare\b/, /\bbaby price\b/,
      /\bbaby ticket\b/, /বেবি টিকেট/, /শিশুর টিকেট/,
      /बच्चे का टिकट/, /शिशु किराया/,
      /குழந்தை டிக்கெட்/, /பேபி கட்டணம்/
    ],
    response: {
      fr: "De 1 jour à moins de 2 ans, catégorie bébé, l'enfant paie généralement les taxes aéroport. De 2 à moins de 12 ans, catégorie enfant. À partir de 12 ans, tarif adulte. Ces règles varient selon la compagnie.",
      en: "From 1 day to under 2 years, baby category, the child generally pays airport taxes only. From 2 to under 12 years, child category. From 12 years, adult fare. These rules may vary by airline.",
      bn: "১ দিন থেকে ২ বছরের কম বয়স পর্যন্ত সাধারণত শিশু শ্রেণিতে শুধু এয়ারপোর্ট ট্যাক্স প্রযোজ্য হয়। ২ থেকে ১২ বছরের কম শিশু শ্রেণি, ১২ বছর থেকে প্রাপ্তবয়স্ক ভাড়া। নিয়ম কোম্পানি অনুযায়ী পরিবর্তিত হতে পারে।",
      hi: "1 दिन से 2 वर्ष से कम आयु तक शिशु श्रेणी में सामान्यतः केवल एयरपोर्ट टैक्स लगता है। 2 से 12 वर्ष से कम आयु तक चाइल्ड श्रेणी, और 12 वर्ष से ऊपर वयस्क किराया। ये नियम एयरलाइन के अनुसार बदल सकते हैं।",
      ta: "1 நாள் முதல் 2 வயதிற்குக் குறைவான குழந்தைகள் பொதுவாக விமான நிலைய வரி மட்டும் செலுத்துவர். 2 முதல் 12 வயதிற்குக் குறைவானோர் குழந்தை பிரிவு; 12 வயதிற்கு மேல் பெரியவர் கட்டணம். விதிகள் விமான நிறுவனம் பொறுத்து மாறலாம்."
    }
  },
  {
    name: 'bebe_bagage',
    priority: 93,
    handoff: false,
    tests: [
      /\bbagage.*bebe\b/, /\bbebe.*bagage\b/, /\bbaby baggage\b/, /\bbaby luggage\b/,
      /বেবির ব্যাগ/, /শিশুর লাগেজ/,
      /शिशु सामान/, /बेबी बैगेज/,
      /பேபி பயணப்பெட்டி/, /குழந்தை பேக்கேஜ்/
    ],
    response: {
      fr: "En général, les bébés ont droit aux bagages, mais cela dépend de la compagnie. Chez Saudia Airlines par exemple, c'est 23 kilos.",
      en: "Generally, babies are entitled to baggage allowance, but this depends on the airline. With Saudia Airlines for example, it's 23 kilos.",
      bn: "সাধারণত শিশুদের জন্যও ব্যাগেজ অনুমতি থাকে, তবে এটি এয়ারলাইনের উপর নির্ভর করে। উদাহরণস্বরূপ Saudia Airlines-এ ২৩ কেজি।",
      hi: "आमतौर पर शिशुओं के लिए भी बैगेज अनुमति होती है, लेकिन यह एयरलाइन पर निर्भर करता है। उदाहरण के लिए Saudia Airlines में 23 किलो।",
      ta: "பொதுவாக குழந்தைகளுக்கும் பயணப்பெட்டி அனுமதி இருக்கும், ஆனால் அது விமான நிறுவனத்தைப் பொறுத்தது. உதாரணமாக Saudia Airlines-இல் 23 கிலோ."
    }
  },
  {
    name: 'enfant_bagage',
    priority: 92,
    handoff: false,
    tests: [
      /\bbagage.*enfant\b/, /\benfant.*bagage\b/, /\bchild baggage\b/, /\bchild luggage\b/,
      /শিশুর ব্যাগ/, /বাচ্চার লাগেজ/,
      /बच्चे का सामान/, /चाइल्ड बैगेज/,
      /குழந்தை பயணப்பெட்டி/, /சிறுவர் லகேஜ்/
    ],
    response: {
      fr: "Les bagages pour les enfants suivent généralement les mêmes normes que pour les adultes, mais cela peut dépendre de la compagnie aérienne.",
      en: "Baggage for children generally follows the same rules as for adults, but this may depend on the airline.",
      bn: "শিশুদের ব্যাগেজ সাধারণত প্রাপ্তবয়স্কদের নিয়মের মতোই হয়, তবে এটি এয়ারলাইনের উপর নির্ভর করতে পারে।",
      hi: "बच्चों का बैगेज सामान्यतः वयस्कों के समान नियमों का पालन करता है, लेकिन यह एयरलाइन पर निर्भर कर सकता है।",
      ta: "குழந்தைகளின் பயணப்பெட்டி பொதுவாக பெரியவர்களின் விதிகளைப் போலவே இருக்கும், ஆனால் அது விமான நிறுவனத்தைப் பொறுத்து மாறலாம்."
    }
  },
  {
    name: 'demande_humain',
    priority: 90,
    handoff: true,
    tests: [
      /\bun agent\b/, /\bun conseiller\b/, /\bservice client\b/, /\breal person\b/,
      /\bspeak to (?:a |an )?(?:agent|human|person)\b/, /\btalk to (?:a |an )?(?:agent|human|person)\b/,
      /\bparler a un agent\b/, /\bparler a un conseiller\b/, /\bparler a quelqu un\b/,
      /\ber shathe kotha\b/, /এজেন্ট/, /মানুষের সাথে কথা/,
      /\bagent se baat\b/, /एजेंट से बात/, /किसी इंसान से बात/,
      /\bagent pesanum\b/, /ஆலோசகருடன்/, /மனிதருடன் பேச/
    ],
    response: {
      fr: "Bien sûr. Merci d'indiquer votre nom, votre numéro de téléphone et l'objet de votre demande. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Of course. Please provide your name, your phone number and the subject of your request. An AMI Voyages advisor will then assist you.",
      bn: "অবশ্যই। অনুগ্রহ করে আপনার নাম, ফোন নম্বর এবং অনুরোধের বিষয় জানান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।",
      hi: "ज़रूर। कृपया अपना नाम, फ़ोन नंबर और अपनी मांग का विषय बताएं। AMI Voyages का एक सलाहकार आपकी मदद करेगा।",
      ta: "நிச்சயமாக. உங்கள் பெயர், தொலைபேசி எண் மற்றும் கோரிக்கையின் பொருள் தெரிவிக்கவும். AMI Voyages-இன் ஒரு ஆலோசகர் உதவுவார்."
    }
  },
  {
    name: 'rappel_client',
    priority: 88,
    handoff: true,
    tests: [
      /\brappelez moi\b/, /\bme rappeler\b/, /\bcall me\b/, /\bcall back\b/,
      /\bcall diben\b/, /কল ব্যাক/, /আমাকে ফোন করুন/,
      /\bmujhe call karo\b/, /मुझे कॉल करें/,
      /\bennai call pannunga\b/, /என்னை அழைக்கவும்/
    ],
    response: {
      fr: "Oui, nous pouvons transmettre votre demande à un conseiller. Merci d'indiquer votre nom et le sujet de votre demande. Un conseiller AMI Voyages prendra le relais.",
      en: "Yes, we can forward your request to an advisor. Please provide your name and the subject of your request. An AMI Voyages advisor will take over.",
      bn: "হ্যাঁ, আমরা আপনার অনুরোধ একজন উপদেষ্টার কাছে পৌঁছে দিতে পারি। অনুগ্রহ করে আপনার নাম এবং অনুরোধের বিষয় জানান। AMI Voyages-এর একজন উপদেষ্টা আপনার সাথে যোগাযোগ করবেন।",
      hi: "हाँ, हम आपकी मांग एक सलाहकार तक पहुँचा सकते हैं। कृपया अपना नाम और अपनी मांग का विषय बताएं। AMI Voyages का एक सलाहकार आगे सहायता करेगा।",
      ta: "ஆம், உங்கள் கோரிக்கையை ஒரு ஆலோசகரிடம் அனுப்பலாம். உங்கள் பெயர் மற்றும் கோரிக்கையின் பொருள் தெரிவிக்கவும். AMI Voyages-இன் ஒரு ஆலோசகர் தொடர்ந்து உதவுவார்."
    }
  },
  {
    name: 'projet_voyage',
    priority: 85,
    handoff: true,
    tests: [
      /\bje veux\b.*\b(?:aller|voyager|partir)\b/, /\bje voudrais\b.*\b(?:aller|voyager|partir)\b/,
      /\bi want\b.*\b(?:go|travel|fly)\b/, /\bi need\b.*\bticket\b/,
      /\bticket chai\b/, /\bticket lagbe\b/, /\bdhaka jete chai\b/,
      /টিকেট চাই/, /যেতে চাই/,
      /\bmujhe\b.*\bjana\b/, /\bticket chahiye\b/, /मुझे.*जाना/, /टिकट चाहिए/,
      /\bvenum\b.*\bticket\b/, /\bpoga\b/, /டிக்கெட் வேண்டும்/, /போக வேண்டும்/
    ],
    response: {
      fr: "Nous pouvons vous aider à organiser votre voyage. Merci d'indiquer votre destination, votre ville de départ, vos dates de départ et de retour, et le nombre de passagers. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "We can help you organize your trip. Please tell us your destination, departure city, departure and return dates, and the number of passengers. An AMI Voyages advisor will then assist you.",
      bn: "আমরা আপনার ভ্রমণ আয়োজন করতে সাহায্য করতে পারি। অনুগ্রহ করে আপনার গন্তব্য, যাত্রার শহর, যাত্রার এবং ফেরার তারিখ, এবং যাত্রীর সংখ্যা জানান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।",
      hi: "हम आपकी यात्रा की योजना बनाने में मदद कर सकते हैं। कृपया अपना गंतव्य, प्रस्थान शहर, जाने और लौटने की तारीखें, और यात्रियों की संख्या बताएं। AMI Voyages का एक सलाहकार आपकी मदद करेगा।",
      ta: "உங்கள் பயணத்தை ஏற்பாடு செய்ய நாங்கள் உதவலாம். உங்கள் இலக்கு, புறப்படும் நகரம், புறப்படும் மற்றும் திரும்பும் தேதிகள், மற்றும் பயணிகள் எண்ணிக்கை தெரிவிக்கவும். AMI Voyages-இன் ஒரு ஆலோசகர் உதவுவார்."
    }
  },
  {
    name: 'horaires_ouverture',
    priority: 80,
    handoff: false,
    tests: [
      /\bhoraires\b/, /\bheures d ouverture\b/, /\bouvrez\b/, /\bfermez\b/,
      /\bopening hours\b/, /\bwhat time\b.*\bopen\b/, /\bwhat time\b.*\bclose\b/,
      /\bkhola\b/, /খোলা/, /সময়/,
      /\bsamay\b/, /खुला/, /समय/,
      /\beppo open\b/, /திறக்கும் நேரம்/, /நேரம்/
    ],
    response: {
      fr: "Nos horaires : AMI Voyages Paris Gare du Nord, 157 rue Lafayette 75010 Paris, du lundi au samedi de 10h00 à 18h30. AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République 93300 Aubervilliers, du mardi au vendredi de 10h00 à 18h30. Vous pouvez aussi nous écrire ici sur WhatsApp.",
      en: "Our hours: AMI Voyages Paris Gare du Nord, 157 rue Lafayette 75010 Paris, Monday to Saturday 10:00am to 6:30pm. AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République 93300 Aubervilliers, Tuesday to Friday 10:00am to 6:30pm. You can also write to us here on WhatsApp.",
      bn: "আমাদের সময়সূচি: AMI Voyages Paris Gare du Nord, 157 rue Lafayette 75010 Paris, সোমবার থেকে শনিবার 10:00 থেকে 18:30। AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République 93300 Aubervilliers, মঙ্গলবার থেকে শুক্রবার 10:00 থেকে 18:30। আপনি WhatsApp-এও আমাদের লিখতে পারেন।",
      hi: "हमारे समय: AMI Voyages Paris Gare du Nord, 157 rue Lafayette 75010 Paris, सोमवार से शनिवार 10:00 से 18:30 तक। AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République 93300 Aubervilliers, मंगलवार से शुक्रवार 10:00 से 18:30 तक। आप हमें यहाँ WhatsApp पर भी लिख सकते हैं।",
      ta: "எங்கள் நேரங்கள்: AMI Voyages Paris Gare du Nord, 157 rue Lafayette 75010 Paris, திங்கள் முதல் சனி வரை 10:00 முதல் 18:30 வரை. AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République 93300 Aubervilliers, செவ்வாய் முதல் வெள்ளி வரை 10:00 முதல் 18:30 வரை. WhatsApp-லிலும் எங்களுக்கு எழுதலாம்."
    }
  },
  {
    name: 'localisation_agences',
    priority: 75,
    handoff: false,
    tests: [
      /\badresse\b/, /\bou etes vous\b/, /\bagence\b/, /\bwhere are you\b/, /\boffice\b/,
      /\bkothay\b/, /কোথায়/, /অফিস/,
      /\bkahan ho\b/, /पता/, /ऑफिस कहाँ/,
      /\benge\b/, /முகவரி/, /அலுவலகம் எங்கு/
    ],
    response: {
      fr: "Nos agences : AMI Voyages Paris Gare du Nord, 157 rue Lafayette 75010 Paris, métro Gare du Nord. AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République 93300 Aubervilliers, métro Quatre Chemins.",
      en: "Our branches: AMI Voyages Paris Gare du Nord, 157 rue Lafayette 75010 Paris, Metro Gare du Nord. AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République 93300 Aubervilliers, Metro Quatre Chemins.",
      bn: "আমাদের শাখা: AMI Voyages Paris Gare du Nord, 157 rue Lafayette 75010 Paris, মেট্রো Gare du Nord। AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République 93300 Aubervilliers, মেট্রো Quatre Chemins।",
      hi: "हमारी शाखाएँ: AMI Voyages Paris Gare du Nord, 157 rue Lafayette 75010 Paris, Metro Gare du Nord। AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République 93300 Aubervilliers, Metro Quatre Chemins।",
      ta: "எங்கள் கிளைகள்: AMI Voyages Paris Gare du Nord, 157 rue Lafayette 75010 Paris, மெட்ரோ Gare du Nord. AMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République 93300 Aubervilliers, மெட்ரோ Quatre Chemins."
    }
  },
  {
    name: 'destination_couverte',
    priority: 70,
    handoff: false,
    tests: [
      /\bbangladesh\b/, /\binde\b/, /\bindia\b/, /\bsri lanka\b/, /\bmali\b/, /\bsenegal\b/,
      /\bguinee\b/, /\bcongo\b/, /\brdc\b/, /\bdo you go to\b/,
      /বাংলাদেশ/, /ভারত/, /শ্রীলঙ্কা/,
      /भारत/, /श्रीलंका/, /माली/,
      /இந்தியா/, /இலங்கை/, /மாலி/
    ],
    response: {
      fr: "Oui, nous travaillons sur cette destination. Merci d'indiquer votre ville de départ et de retour, vos dates, le nombre de passagers et vos préférences. Un agent vous indiquera le meilleur prix.",
      en: "Yes, we work on this destination. Please tell us your departure and return city, your dates, number of passengers and any preferences. An agent will give you the best price.",
      bn: "হ্যাঁ, আমরা এই গন্তব্যে কাজ করি। অনুগ্রহ করে আপনার যাত্রার এবং ফেরার শহর, তারিখ, যাত্রীর সংখ্যা এবং পছন্দ জানান। একজন এজেন্ট আপনাকে সেরা মূল্য জানাবেন।",
      hi: "हाँ, हम इस गंतव्य पर काम करते हैं। कृपया अपना प्रस्थान और वापसी शहर, तारीखें, यात्रियों की संख्या और अपनी पसंद बताएं। एक एजेंट आपको सर्वोत्तम मूल्य बताएगा।",
      ta: "ஆம், இந்த இலக்கில் நாங்கள் சேவை செய்கிறோம். உங்கள் புறப்பாடு மற்றும் திரும்பும் நகரம், தேதிகள், பயணிகள் எண்ணிக்கை மற்றும் விருப்பங்கள் தெரிவிக்கவும். ஒரு ஏஜெண்ட் உங்களுக்கு சிறந்த விலையை தெரிவிப்பார்."
    }
  },
  {
    name: 'promos',
    priority: 65,
    handoff: false,
    tests: [
      /\bpromo\b/, /\bpromotion\b/, /\boffre speciale\b/, /\boffer\b/, /\bspecial fare\b/,
      /\boffer ache\b/, /অফার/, /কম দামে/,
      /\bpromo hai\b/, /ऑफर/, /सस्ता किराया/,
      /\bpromo irukka\b/, /சலுகை/, /குறைந்த விலை/
    ],
    response: {
      fr: "Nous proposons des tarifs avantageux au départ de la France avec retour en France, ainsi que sur Lisbonne-Dhaka. Les meilleurs tarifs sont en général hors vacances scolaires et hors week-end. Indiquez-nous votre destination, vos villes, vos dates et le nombre de passagers.",
      en: "We offer competitive fares departing from France and returning to France, as well as on Lisbon-Dhaka. The best fares are usually outside school holidays and weekends. Please tell us your destination, cities, dates and number of passengers.",
      bn: "আমরা ফ্রান্স থেকে যাত্রা এবং ফ্রান্সে প্রত্যাবর্তনের জন্য, পাশাপাশি Lisbonne-Dhaka রুটেও ভালো ভাড়া দিই। সাধারণত স্কুল ছুটি ও সপ্তাহান্তের বাইরে ভালো দাম পাওয়া যায়। আপনার গন্তব্য, শহর, তারিখ এবং যাত্রীর সংখ্যা জানান।",
      hi: "हम फ्रांस से प्रस्थान और फ्रांस वापसी वाली यात्राओं पर, साथ ही Lisbon-Dhaka मार्ग पर भी अच्छे किराये देते हैं। बेहतर किराये आमतौर पर स्कूल की छुट्टियों और सप्ताहांत के बाहर मिलते हैं। कृपया अपना गंतव्य, शहर, तारीखें और यात्रियों की संख्या बताएं।",
      ta: "பிரான்ஸில் இருந்து புறப்பட்டு பிரான்ஸுக்கே திரும்பும் பயணங்களுக்கும், Lisbon-Dhaka பாதைக்கும் நாங்கள் நல்ல கட்டணங்கள் வழங்குகிறோம். பொதுவாக பள்ளி விடுமுறை மற்றும் வார இறுதி நாட்களுக்கு வெளியே சிறந்த விலைகள் கிடைக்கும். உங்கள் இலக்கு, நகரங்கள், தேதிகள் மற்றும் பயணிகள் எண்ணிக்கை தெரிவிக்கவும்."
    }
  },
  {
    name: 'bus',
    priority: 60,
    handoff: false,
    tests: [
      /\bbus\b/, /\bcoach\b/, /\bdo you have bus\b/,
      /বাস/, /বাস টিকেট/,
      /बस/, /बस टिकट/,
      /பஸ்/, /பஸ் டிக்கெட்/
    ],
    response: {
      fr: "Non, AMI Voyages propose uniquement des voyages aériens. Nous sommes spécialisés dans les destinations d'Asie du Sud, notamment le Bangladesh, l'Inde, le Sri Lanka, et d'Afrique subsaharienne comme le Mali, le Sénégal, la Guinée et la RDC.",
      en: "No, AMI Voyages only offers air travel. We specialize in South Asian destinations such as Bangladesh, India, Sri Lanka, and sub-Saharan African destinations like Mali, Senegal, Guinea and the DRC.",
      bn: "না, AMI Voyages শুধু বিমান ভ্রমণ সেবা দেয়। আমরা দক্ষিণ এশিয়ার গন্তব্য যেমন বাংলাদেশ, ভারত, শ্রীলঙ্কা এবং সাব-সাহারান আফ্রিকার গন্তব্য যেমন মালি, সেনেগাল, গিনি ও RDC-তে বিশেষজ্ঞ।",
      hi: "नहीं, AMI Voyages केवल हवाई यात्रा सेवाएँ प्रदान करता है। हम दक्षिण एशियाई गंतव्यों जैसे बांग्लादेश, भारत, श्रीलंका और उप-सहारा अफ्रीकी गंतव्यों जैसे माली, सेनेगल, गिनी और RDC में विशेषज्ञ हैं।",
      ta: "இல்லை, AMI Voyages விமானப் பயண சேவைகள் மட்டுமே வழங்குகிறது. நாங்கள் பங்களாதேஷ், இந்தியா, இலங்கை போன்ற தென் ஆசிய இலக்குகள் மற்றும் மாலி, செனெகல், கினி, RDC போன்ற சஹாராவிற்கு தெற்கான ஆப்ரிக்க இலக்குகளில் நிபுணத்துவம் பெற்றுள்ளோம்."
    }
  },
  {
    name: 'appel_non_repondu',
    priority: 58,
    handoff: false,
    tests: [
      /\bne repondez pas\b/, /\bn arrive pas a vous joindre\b/, /\bappel manque\b/,
      /\bdon t answer\b/, /\bcan t reach you\b/,
      /\bdhoren na\b/, /ফোন ধরেন না/,
      /\bphone nahi uthaya\b/, /कॉल का जवाब नहीं/,
      /\bphone edukkala\b/, /அழைப்புக்கு பதில் இல்லை/
    ],
    response: {
      fr: "Nous sommes désolés si vous n'avez pas reçu de réponse rapide. Pouvez-vous nous préciser votre demande ou nous laisser votre numéro ? Un conseiller AMI Voyages vous reviendra dès que possible.",
      en: "We are sorry if you didn't receive a quick response. Could you clarify your request or leave us your number? An AMI Voyages advisor will get back to you as soon as possible.",
      bn: "দ্রুত উত্তর না পেয়ে থাকলে আমরা দুঃখিত। আপনি কি আপনার অনুরোধটি বিস্তারিত জানাতে পারেন অথবা আপনার নম্বর দিতে পারেন? AMI Voyages-এর একজন উপদেষ্টা দ্রুত আপনার সাথে যোগাযোগ করবেন।",
      hi: "यदि आपको जल्दी उत्तर नहीं मिला तो हमें खेद है। क्या आप अपनी मांग स्पष्ट कर सकते हैं या अपना नंबर छोड़ सकते हैं? AMI Voyages का एक सलाहकार जल्द ही आपसे संपर्क करेगा।",
      ta: "விரைவாக பதில் கிடைக்கவில்லை என்றால் மன்னிக்கவும். உங்கள் கோரிக்கையை தெளிவாக தெரிவிக்கலாம் அல்லது உங்கள் எண்ணை விடலாம். AMI Voyages-இன் ஒரு ஆலோசகர் விரைவில் தொடர்பு கொள்வார்."
    }
  },
  {
    name: 'agent_disponible',
    priority: 56,
    handoff: false,
    tests: [
      /\bdisponible\b/, /\bquelqu un disponible\b/, /\bavailable\b/, /\banyone available\b/,
      /\bfree ache\b/, /কেউ আছেন/,
      /\bkoi available hai\b/, /कोई उपलब्ध है/,
      /\byaravadhu irukkingala\b/, /யாராவது உள்ளீர்களா/
    ],
    response: {
      fr: "Nos conseillers sont disponibles selon leur planning. Nous faisons de notre mieux pour répondre rapidement pendant les horaires d'ouverture. En dehors de ces horaires, vous pouvez déjà nous laisser votre demande ici sur WhatsApp.",
      en: "Our advisors are available according to their schedule. We do our best to respond quickly during opening hours. Outside these hours, you can leave your request here on WhatsApp.",
      bn: "আমাদের উপদেষ্টারা তাদের সময়সূচি অনুযায়ী উপলব্ধ থাকেন। খোলার সময় আমরা যত দ্রুত সম্ভব উত্তর দেওয়ার চেষ্টা করি। এর বাইরে, আপনি WhatsApp-এ আপনার অনুরোধ পাঠাতে পারেন।",
      hi: "हमारे सलाहकार अपने समयानुसार उपलब्ध होते हैं। खुलने के समय हम यथासंभव जल्दी उत्तर देने की कोशिश करते हैं। उसके बाहर भी आप WhatsApp पर अपनी मांग भेज सकते हैं।",
      ta: "எங்கள் ஆலோசகர்கள் தங்கள் அட்டவணைப்படி கிடைப்பார்கள். திறந்த நேரங்களில் விரைவாக பதிலளிக்க முயற்சிக்கிறோம். அதற்கு வெளியேயும் WhatsApp-ல் உங்கள் கோரிக்கையை விடலாம்."
    }
  },
  {
    name: 'delai_reponse',
    priority: 54,
    handoff: false,
    tests: [
      /\bdelai de reponse\b/, /\bcombien de temps\b/, /\bresponse time\b/, /\bhow long to respond\b/,
      /\breply pabo\b/, /কত সময়/,
      /\bkitna waqt lagega\b/, /जवाब में कितना समय/,
      /\bevlo neram\b/, /எவ்வளவு நேரம்/
    ],
    response: {
      fr: "Nous faisons de notre mieux pour répondre dans les meilleurs délais pendant les horaires d'ouverture. En dehors de ces horaires, vous pouvez déjà nous laisser votre demande ici sur WhatsApp.",
      en: "We do our best to respond as quickly as possible during opening hours. Outside these hours, you can leave your request here on WhatsApp.",
      bn: "খোলার সময় আমরা যত দ্রুত সম্ভব উত্তর দেওয়ার চেষ্টা করি। এর বাইরে, আপনি WhatsApp-এ আপনার অনুরোধ রেখে যেতে পারেন।",
      hi: "खुलने के समय हम यथासंभव जल्दी जवाब देने की कोशिश करते हैं। उसके बाहर भी आप WhatsApp पर अपनी मांग छोड़ सकते हैं।",
      ta: "திறந்த நேரங்களில் எங்களால் முடிந்தவரை விரைவாக பதிலளிக்க முயற்சிக்கிறோம். அதற்கு வெளியேயும் WhatsApp-ல் உங்கள் கோரிக்கையை விடலாம்."
    }
  },
  {
    name: 'duree_minimum',
    priority: 50,
    handoff: false,
    tests: [
      /\bminimum\b.*\bjours\b/, /\bminimum stay\b/, /\bhow many days minimum\b/,
      /\bminimum din\b/, /কত দিন/,
      /\bminimum din kitne\b/, /कम से कम कितने दिन/,
      /\bminimum naal\b/, /குறைந்தபட்சம் எத்தனை நாள்/
    ],
    response: {
      fr: "En Asie, le séjour minimum est généralement de 5 à 7 jours. En Afrique, c'est généralement 3 jours, selon la compagnie aérienne.",
      en: "In Asia, the minimum stay is generally 5 to 7 days. In Africa, it's generally 3 days, depending on the airline.",
      bn: "এশিয়ায় সাধারণত ন্যূনতম অবস্থান ৫ থেকে ৭ দিন। আফ্রিকায় সাধারণত ৩ দিন, এয়ারলাইনের উপর নির্ভর করে।",
      hi: "एशिया में सामान्यतः न्यूनतम ठहराव 5 से 7 दिन होता है। अफ्रीका में सामान्यतः 3 दिन, एयरलाइन के अनुसार।",
      ta: "ஆசியாவில் பொதுவாக குறைந்தபட்ச தங்கும் காலம் 5 முதல் 7 நாட்கள். ஆப்ரிக்காவில் பொதுவாக 3 நாட்கள், விமான நிறுவனம் பொறுத்தது."
    }
  },
  {
    name: 'remerciement',
    priority: 45,
    handoff: false,
    tests: [
      /\bmerci\b/, /\bthank you\b/, /\bthanks\b/, /\bdhonnobad\b/, /ধন্যবাদ/,
      /\bdhanyavad\b/, /\bshukriya\b/, /धन्यवाद/,
      /\bnanri\b/, /நன்றி/
    ],
    response: {
      fr: "Avec plaisir. Je reste à votre disposition pour votre voyage.",
      en: "You're welcome. I remain available to help with your trip.",
      bn: "স্বাগতম। আপনার ভ্রমণে সহায়তার জন্য আমি আছি।",
      hi: "आपका स्वागत है। मैं आपकी यात्रा में सहायता के लिए उपलब्ध हूँ।",
      ta: "வரவேற்கிறேன். உங்கள் பயணத்திற்கு உதவ நான் தயாராக இருக்கிறேன்."
    }
  },
  {
    name: 'cava',
    priority: 43,
    handoff: false,
    tests: [
      /\bca va\b/, /\bcomment allez vous\b/, /\bhow are you\b/, /\bhow is it going\b/,
      /\bkemon achen\b/, /কেমন আছেন/,
      /\bkaise ho\b/, /कैसे हैं/,
      /\beppadi irukeenga\b/, /எப்படி இருக்கிறீர்கள்/
    ],
    response: {
      fr: "Très bien, merci ! Bienvenue chez AMI Voyages, spécialisée dans les vols vers l'Asie du Sud et l'Afrique subsaharienne. En quoi puis-je vous aider ?",
      en: "Very well, thank you! Welcome to AMI Voyages, specialized in flights to South Asia and sub-Saharan Africa. How can I help you?",
      bn: "ভাল আছি, ধন্যবাদ! AMI Voyages-এ স্বাগতম। আমরা দক্ষিণ এশিয়া ও সাব-সাহারান আফ্রিকার ফ্লাইটে বিশেষজ্ঞ। কীভাবে সাহায্য করতে পারি?",
      hi: "मैं ठीक हूँ, धन्यवाद! AMI Voyages में आपका स्वागत है। हम दक्षिण एशिया और उप-सहारा अफ्रीका की उड़ानों में विशेषज्ञ हैं। मैं आपकी कैसे मदद कर सकता हूँ?",
      ta: "நான் நன்றாக இருக்கிறேன், நன்றி! AMI Voyages-க்கு வரவேற்கிறோம். தென் ஆசியா மற்றும் சஹாராவிற்கு தெற்கான ஆப்ரிக்கா நோக்கி செல்லும் விமானங்களில் நாங்கள் நிபுணத்துவம் பெற்றுள்ளோம். எப்படி உதவலாம்?"
    }
  },
  {
    name: 'salutation',
    priority: 41,
    handoff: false,
    tests: [
      /\bbonjour\b/, /\bsalut\b/, /\bbonsoir\b/,
      /\bhello\b/, /\bhi\b/, /\bhey\b/, /\bgood morning\b/, /\bgood evening\b/,
      /হ্যালো/, /সালাম/,
      /\bnamaste\b/, /\bnamaskar\b/, /\bpranam\b/, /\badaab\b/,
      /नमस्ते/, /नमस्कार/,
      /\bvanakkam\b/, /\bvanakam\b/,
      /வணக்கம்/, /ஹலோ/
    ],
    response: {
      fr: "Bonjour, bienvenue chez AMI Voyages. Nous sommes spécialisés dans les vols vers l'Asie du Sud et l'Afrique subsaharienne. En quoi puis-je vous aider ?",
      en: "Hello, welcome to AMI Voyages. We specialize in flights to South Asia and sub-Saharan Africa. How can I help you?",
      bn: "স্বাগতম AMI Voyages-এ। আমরা দক্ষিণ এশিয়া ও সাব-সাহারান আফ্রিকার ফ্লাইটে বিশেষজ্ঞ। কীভাবে সাহায্য করতে পারি?",
      hi: "नमस्ते, AMI Voyages में आपका स्वागत है। हम दक्षिण एशिया और उप-सहारा अफ्रीका की उड़ानों में विशेषज्ञ हैं। मैं आपकी कैसे मदद कर सकता हूँ?",
      ta: "வணக்கம், AMI Voyages-க்கு வரவேற்கிறோம். தென் ஆசியா மற்றும் சஹாராவிற்கு தெற்கான ஆப்ரிக்கா செல்லும் விமானங்களில் நாங்கள் நிபுணத்துவம் பெற்றுள்ளோம். எப்படி உதவலாம்?"
    }
  },
  {
    name: 'salam',
    priority: 40,
    handoff: false,
    tests: [
      /\bsalam\b/, /\baleykoum\b/, /\balaikum\b/, /আসসালামু/, /السلام/,
      /सलाम/, /आदाब/,
      /ஸலாம்/
    ],
    response: {
      fr: "Walaikum salam, bienvenue chez AMI Voyages. Nous sommes spécialisés dans les vols vers l'Asie du Sud et l'Afrique subsaharienne. En quoi puis-je vous aider ?",
      en: "Walaikum assalam, welcome to AMI Voyages. We specialize in flights to South Asia and sub-Saharan Africa. How can I help you?",
      bn: "ওয়ালাইকুম আসসালাম, AMI Voyages-এ স্বাগতম। আমরা দক্ষিণ এশিয়া ও সাব-সাহারান আফ্রিকার ফ্লাইটে বিশেষজ্ঞ। কীভাবে সাহায্য করতে পারি?",
      hi: "वालेकुम अस्सलाम, AMI Voyages में आपका स्वागत है। हम दक्षिण एशिया और उप-सहारा अफ्रीका की उड़ानों में विशेषज्ञ हैं। मैं आपकी कैसे मदद कर सकता हूँ?",
      ta: "வஅலைக்கும் ஸலாம், AMI Voyages-க்கு வரவேற்கிறோம். தென் ஆசியா மற்றும் சஹாராவிற்கு தெற்கான ஆப்ரிக்கா விமானங்களில் நாங்கள் நிபுணத்துவம் பெற்றுள்ளோம். எப்படி உதவலாம்?"
    }
  },
  {
    name: 'aurevoir',
    priority: 38,
    handoff: false,
    tests: [
      /\baurevoir\b/, /\ba bientot\b/, /\bbonne journee\b/, /\bbye\b/, /\bsee you\b/,
      /\bkhoda hafez\b/, /আবার দেখা হবে/,
      /\bphir milenge\b/, /फिर मिलेंगे/,
      /\bpoi varen\b/, /மீண்டும் சந்திப்போம்/
    ],
    response: {
      fr: "Merci pour votre message. À bientôt chez AMI Voyages.",
      en: "Thank you for your message. See you soon at AMI Voyages.",
      bn: "আপনার বার্তার জন্য ধন্যবাদ। আবার দেখা হবে AMI Voyages-এ।",
      hi: "आपके संदेश के लिए धन्यवाद। AMI Voyages में फिर मिलेंगे।",
      ta: "உங்கள் செய்திக்கு நன்றி. AMI Voyages-இல் மீண்டும் சந்திப்போம்."
    }
  }
].sort((a, b) => b.priority - a.priority);

// =====================================================================
// DETECTION D'INTENTION
// =====================================================================
function detectIntent(message) {
  const normalizedMessage = normalizeText(message);
  const rawMessage = String(message || '');

  for (const intent of INTENTS) {
    try {
      const matched = intent.tests.some((regex) => {
        if (hasTamilScript(rawMessage) || hasDevanagariScript(rawMessage) || hasBengaliScript(rawMessage)) {
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
    return t('fr', 'empty_message');
  }

  const lang = detectLanguage(safeText);
  const { greeting, rest, isOnlyGreeting } = parseLeadingGreeting(safeText, lang);
  const cleanText = rest || safeText;

  if (isOnlyGreeting) {
    const intent = detectIntent(safeText);
    const responseText = intent ? (intent.response?.[lang] || intent.response?.fr) : t(lang, 'empty_message');
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
          bn: `দারুণ, আমরা ${destination}-এ আপনার ভ্রমণ আয়োজন করতে সাহায্য করতে পারি। অনুগ্রহ করে আপনার যাত্রার শহর, যাত্রা ও ফেরার তারিখ, এবং যাত্রীর সংখ্যা জানান। AMI Voyages-এর একজন উপদেষ্টা আপনাকে সহায়তা করবেন।`,
          hi: `बहुत अच्छा, हम ${destination} की आपकी यात्रा आयोजित करने में मदद कर सकते हैं। कृपया अपना प्रस्थान शहर, जाने और लौटने की तारीखें, और यात्रियों की संख्या बताएं। AMI Voyages का एक सलाहकार आपकी मदद करेगा।`,
          ta: `சிறப்பு, ${destination} நோக்கி உங்கள் பயணத்தை ஏற்பாடு செய்ய நாங்கள் உதவலாம். உங்கள் புறப்படும் நகரம், புறப்படும் மற்றும் திரும்பும் தேதிகள், மற்றும் பயணிகள் எண்ணிக்கை தெரிவிக்கவும். AMI Voyages-இன் ஒரு ஆலோசகர் உதவுவார்.`
        };

        if (intent.handoff && sender) {
          saveSession(sender, {
            awaitingContact: true,
            intent: intent.name,
            timestamp: Date.now(),
            lang
          });
        }

        return prefixResponse(greeting, messages[lang] || messages.fr);
      }
    }

    if (intent.handoff && sender) {
      saveSession(sender, {
        awaitingContact: true,
        intent: intent.name,
        timestamp: Date.now(),
        lang
      });
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
  // TODO: intégrer un vrai service de transcription (ex: OpenAI Whisper API)
  return '';
}

async function downloadFile(url, destPath) {
  const writer = fs.createWriteStream(destPath);
  const response = await axios.get(url, {
    responseType: 'stream',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
    }
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
      params: {
        access_token: process.env.WHATSAPP_TOKEN
      }
    });

    const mediaUrl = mediaUrlResp.data?.url;
    if (!mediaUrl) return t('fr', 'unsupported_media');

    const tmpPath = `./tmp-audio-${Date.now()}.ogg`;
    await downloadFile(mediaUrl, tmpPath);

    const transcription = await transcribeAudio(tmpPath);

    try {
      await fs.promises.unlink(tmpPath);
    } catch (e) {
      // ignorer
    }

    if (!transcription || !transcription.trim()) {
      return t('fr', 'no_transcription');
    }

    return await generateTravelReply(transcription, sender);
  } catch (e) {
    console.warn('AUDIO | Erreur :', e.message || e);
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
      text: {
        preview_url: false,
        body: text
      }
    };

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('WA | Message envoyé :', response.data?.messages?.[0]?.id || 'pas d\u2019id');
  } catch (error) {
    console.error('WA | Erreur d\u2019envoi :', error.response?.data || error.message || error);
    throw error;
  }
}

// =====================================================================
// ROUTES
// =====================================================================
app.get('/', (req, res) => {
  res.send('WhatIA AMI Voyages est en cours d\u2019exécution.');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime()
  });
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

    if (!messages.length) {
      return res.status(200).send('Aucun message');
    }

    const message = messages[0];
    const messageId = message?.id || null;

    if (messageId && isMessageProcessed(messageId)) {
      console.log('WEBHOOK | Doublon ignoré :', messageId);
      return res.status(200).send('Doublon ignoré');
    }

    markMessageProcessed(messageId);

    const sender = message.from;
    let replyText = '';

    if (message.type === 'text' && message.text?.body) {
      console.log('WEBHOOK | Message texte reçu de', sender, ':', message.text.body);
      replyText = await handleTextMessage(message.text.body, sender);
    } else if (['audio', 'voice'].includes(message.type)) {
      console.log('WEBHOOK | Message audio reçu de', sender);
      replyText = await handleAudioMessage(message, sender);
    } else if (['sticker', 'image', 'video', 'document', 'location', 'contacts'].includes(message.type)) {
      replyText = t('fr', 'unsupported_media');
    } else {
      replyText = t('fr', 'unknown_message');
    }

    await sendWhatsAppText(sender, replyText);

    return res.status(200).send('OK');
  } catch (error) {
    console.error('WEBHOOK | Erreur de traitement :', error);
    return res.status(500).send('Erreur serveur');
  }
});

app.listen(PORT, () => {
  console.log(`WhatIA AMI Voyages en écoute sur le port ${PORT}`);
});