'use strict';

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
    slt: 'salut', slm: 'salam',
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
function hasBengaliScript(text) {
  return /[\u0980-\u09FF]/.test(String(text || ''));
}

const BANGLISH_WORDS = new Set([
  'ami', 'amar', 'amra', 'apni', 'apnar', 'ache', 'ase', 'ace', 'chai', 'chay',
  'lagbe', 'lagbey', 'jabo', 'zabo', 'jete', 'kotha', 'kothay', 'koto', 'coto',
  'kotho', 'taka', 'kobe', 'kokhon', 'khola', 'bolbo', 'bolte', 'bolun', 'korun',
  'diben', 'pathan', 'pathao',
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
  if (hasBengaliScript(raw)) return 'bn';
  const normalized = normalizeText(raw);
  const words = normalized.split(' ').filter(Boolean);
  let frCount = 0, enCount = 0, bnCount = 0;
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
// FONCTIONS UTILITAIRES
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

function extractTravelDestination(text = '') {
  const normalized = normalizeText(text);
  const patterns = [
    /\b(?:je veux|je voudrais|jveux|jveu|j aimerais|je souhaite)\s+(?:aller|voyager|partir)\s+(?:en|a|au|aux|vers|p(?:ou)?r)\s+([a-z][a-z\s]{1,60})/,
    /\bje cherche\s+(?:un vol\s+)?(?:p(?:ou)?r|en|a|au|aux|vers)\s+([a-z][a-z\s]{1,60})/,
    /\bbil(?:l)?et\s+p(?:ou)?r\s+([a-z][a-z\s]{1,60})/,
    /\bvol\s+p(?:ou)?r\s+([a-z][a-z\s]{1,60})/,
    /\bpartir\s+(?:p(?:ou)?r|en|a|au|aux|vers)\s+([a-z][a-z\s]{1,60})/,
    /\bdispo(?:nible)?\s+p(?:ou)?r\s+([a-z][a-z\s]{1,60})/,
    /\b(?:i want|i d like|i would like|i need)\s+(?:to\s+)?(?:go|travel|fly)\s+to\s+([a-z][a-z\s]{1,60})/,
    /\bticket\s+to\s+([a-z][a-z\s]{1,60})/,
    /\bflight\s+to\s+([a-z][a-z\s]{1,60})/,
    /\bprice\s+for\s+([a-z][a-z\s]{1,60})/,
    /\bami\s+([a-z]{3,30})\s+(?:jete|jabo|zabo)\s+chai\b/,
    /\b([a-z]{3,30})\s+jete\s+chai\b/,
    /\b([a-z]{3,30})\s+(?:ticket|tiket)\s+(?:lagbe|chai)\b/
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return '';
}

function parseLeadingGreeting(text = '', lang = 'fr') {
  const normalized = normalizeText(text);
  if (lang === 'en') {
    const m = normalized.match(/^(?:hello|hi|hey|good morning|good afternoon|good evening)\b[\s,]*(.*)$/);
    if (m) return { greeting: 'Hello', rest: String(m[1] || '').trim(), isOnlyGreeting: !m[1]?.trim() };
  } else if (lang === 'bn') {
    const ms = normalized.match(/^(?:salam(?:\s+aleykoum)?|assalamu alaikum|assalamualaikum)\b[\s,]*(.*)$/);
    if (ms) return { greeting: 'Walaikum assalam', rest: String(ms[1] || '').trim(), isOnlyGreeting: !ms[1]?.trim() };
    const mh = normalized.match(/^(?:hello|hi|hey)\b[\s,]*(.*)$/);
    if (mh) return { greeting: 'Hello', rest: String(mh[1] || '').trim(), isOnlyGreeting: !mh[1]?.trim() };
  } else {
    const mb = normalized.match(/^(?:bonjour|salut|coucou|bonsoir)\b[\s,]*(.*)$/);
    if (mb) return { greeting: 'Bonjour', rest: String(mb[1] || '').trim(), isOnlyGreeting: !mb[1]?.trim() };
    const ms = normalized.match(/^salam(?:\s+aleykoum)?\b[\s,]*(.*)$/);
    if (ms) return { greeting: 'Walaikum salam', rest: String(ms[1] || '').trim(), isOnlyGreeting: !ms[1]?.trim() };
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
// COMMANDES DE REINITIALISATION (menu / back)
// =====================================================================
const RESET_COMMANDS_FR = ['menu', 'retour', 'retour au menu', 'recommencer', 'accueil', 'revenir'];
const RESET_COMMANDS_EN = ['menu', 'back', 'main menu', 'restart', 'start over', 'home'];
const RESET_COMMANDS_BN = ['menu', 'menu te jao', 'pratham menu'];

function isResetCommand(text = '', lang = 'fr') {
  const normalized = normalizeText(text).trim();
  const allReset = [...RESET_COMMANDS_FR, ...RESET_COMMANDS_EN, ...RESET_COMMANDS_BN];
  return allReset.includes(normalized);
}

// =====================================================================
// INTENTIONS (triées par priorité décroissante)
// =====================================================================
const INTENTS = [
  {
    name: 'vol_annule_retarde', priority: 130, handoff: true,
    tests: [
      /\bvol annule\b/, /\bvol retarde\b/, /\bmon vol (?:a ete |est )?annule\b/,
      /\bmon vol (?:a ete |est )?retarde\b/, /\bflight cancel(?:l)?ed\b/,
      /\bmy flight (?:was |is )?cancel(?:l)?ed\b/, /\bflight delay(?:ed)?\b/,
      /\bmy flight (?:is |was )?delayed\b/,
      /\bflight cancel\b/, /\bamar flight cancel\b/, /\bcancel ho(?:ye)?(?:che|gese|geche)?\b/,
      /আমার ফ্লাইট ক্যান্সেল/, /ফ্লাইট বাতিল/, /ফ্লাইট দেরি/
    ],
    flowTarget: 'modify_cancel', submenuHint: 'sub_flight_cancelled'
  },
  {
    name: 'confirmation_vol', priority: 125, handoff: true,
    tests: [
      /\bstatut de mon vol\b/, /\best ce que mon vol est confirme\b/,
      /\bmon vol (?:est |)confirme\b/, /\bflight status\b/, /\bis my flight confirmed\b/,
      /\bmy (?:flight|booking) confirm(?:ed|ation)?\b/,
      /\bflight confirm\b/, /\bamar flight confirmed\b/, /\bticket confirmed\b/,
      /\bconfirm hoye(?:che)?\b/, /\bconfirm ache\b/,
      /আমার ফ্লাইট কনফার্ম/, /টিকেট কনফার্ম/
    ],
    flowTarget: 'check_booking'
  },
  {
    name: 'annulation_billet', priority: 120, handoff: true,
    tests: [
      /\bannuler mon billet\b/, /\bje veux annuler\b/, /\bannulation\b/, /\banulasion\b/,
      /\bannuller\b/, /\bcancel my ticket\b/, /\bcancel my booking\b/,
      /\bi want to cancel\b/, /\bcancell?ation\b/, /\bcancell\b/,
      /\bticket cancel\b/, /\bbooking cancel\b/, /\bcancel korte chai\b/,
      /\bcancel korten\b/, /\bcancel lagbe\b/, /\bticket cancel kori\b/,
      /টিকেট বাতিল/, /বুকিং বাতিল/, /বাতিল করতে চাই/
    ],
    flowTarget: 'modify_cancel', submenuHint: 'sub_cancel'
  },
  {
    name: 'modification_billet', priority: 118, handoff: true,
    tests: [
      /\bmodifier mon billet\b/, /\bmodifier mon vol\b/, /\bchanger mon vol\b/,
      /\bje veux changer mon billet\b/, /\bchanger mon billet\b/,
      /\bchanger la date\b/, /\bchangement de date\b/, /\bmodif\b/, /\bchnage\b/,
      /\bmodify my (?:ticket|flight|booking)\b/, /\bchange my (?:ticket|flight|booking|date)\b/,
      /\bi want to change my flight\b/, /\bchange flight date\b/, /\bdate change\b/,
      /\bticket change\b/, /\bflight change\b/, /\bdate change korte\b/,
      /টিকেট পরিবর্তন/, /তারিখ পরিবর্তন/, /ফ্লাইট পরিবর্তন/
    ],
    flowTarget: 'modify_cancel'
  },
  {
    name: 'verification_dossier', priority: 115, handoff: true,
    tests: [
      /\bverifier mon dossier\b/, /\bverification de dossier\b/, /\bstatut de mon dossier\b/,
      /\bcheck my booking\b/, /\bverify my booking\b/, /\bbooking status\b/,
      /\bcan you check my booking\b/,
      /\bamar booking check\b/, /\bbooking check korun\b/, /\bdossier check\b/,
      /বুকিং চেক/, /আমার বুকিং চেক করুন/
    ],
    flowTarget: 'check_booking'
  },
  {
    name: 'prix_disponibilite', priority: 110, handoff: true,
    tests: [
      /\bprix\b/, /\btarif\b/, /\btarf\b/, /\bcombien\b/, /\bcombient\b/,
      /\bcbien\b/, /\bcmbien\b/, /\bc est combien\b/, /\bdisponibilite\b/,
      /\bvous avez dispo\b/, /\bdispo\s+p(?:ou)?r\b/, /\bavez vous des places\b/,
      /\bvous avez des places\b/, /\bhow much\b/, /\bcost\b/, /\bfare\b/, /\bfares\b/,
      /\bany availability\b/, /\bseats available\b/, /\bavailability\b/, /\bprice for\b/,
      /\bflight price\b/, /\bprice koto\b/, /\brate koto\b/, /\bkoto taka\b/,
      /\bdaam koto\b/, /\bticket price\b/, /\bflight ache\b/, /\bseat ache\b/,
      /দাম কত/, /টিকেটের দাম/, /কত টাকা/, /সিট আছে/
    ],
    flowTarget: 'price'
  },
  {
    name: 'devis', priority: 108, handoff: true,
    tests: [
      /\bdevis\b/, /\bje veux un devis\b/, /\bbesoin de devis\b/, /\bquote\b/,
      /\bi want a quote\b/, /\bi need a quote\b/, /\bquote chai\b/, /\bestimate lagbe\b/,
      /কোটেশন/, /দাম জানতে চাই/
    ],
    flowTarget: 'price'
  },
  {
    name: 'paiement_conditions', priority: 106, handoff: true,
    tests: [
      /\bmoyens de paiement\b/, /\bconditions de paiement\b/, /\bmodalites? de paiement\b/,
      /\bcomment payer\b/, /\bpayment method\b/, /\bpayment options?\b/,
      /\bhow do i pay\b/, /\bhow can i pay\b/,
      /\bpayment er niyom\b/, /\bpayment kore\b/,
      /পেমেন্টের নিয়ম/, /কিভাবে পেমেন্ট করব/
    ],
    flowTarget: 'payment', submenuHint: 'sub_payment_methods'
  },
  {
    name: 'lien_paiement', priority: 105, handoff: true,
    tests: [
      /\blien de paiement\b/, /\benvoyer (?:un |le )?lien de paiement\b/,
      /\bpayment link\b/, /\bsend (?:me )?(?:a |the )?payment link\b/,
      /\bpayment link pathan\b/, /\bpayment link den\b/, /\bpayment link chai\b/,
      /পেমেন্ট লিংক পাঠান/, /পেমেন্ট লিংক চাই/
    ],
    flowTarget: 'payment', submenuHint: 'sub_payment_link'
  },
  {
    name: 'paiement_distance', priority: 104, handoff: true,
    tests: [
      /\bpaiement a distance\b/, /\bpaiement en ligne\b/, /\btelepaiement\b/,
      /\bonline payment\b/, /\bremote payment\b/, /\bpay online\b/,
      /\bonline peyment\b/, /\bonline taka dibo\b/,
      /অনলাইন পেমেন্ট/
    ],
    flowTarget: 'payment', submenuHint: 'sub_remote_payment'
  },
  {
    name: 'visa', priority: 102, handoff: true,
    tests: [
      /\bvisa\b/, /\bviza\b/, /\bdemande de visa\b/, /\bvisa pour\b/,
      /\bvisa application\b/, /\bvisa info\b/, /\bneed visa\b/,
      /\bvisa lagbe\b/, /\bvisa chai\b/, /\bvisa lage\b/, /\bvisa diben\b/,
      /\bbiza lagbe\b/, /\bamar visa\b/,
      /ভিসা লাগবে/, /ভিসার জন্য/, /আমার ভিসা/, /ভিসা চাই/
    ],
    flowTarget: 'visa_docs', submenuHint: 'sub_visa'
  },
  {
    name: 'documents_voyage', priority: 100, handoff: true,
    tests: [
      /\bdocuments? pour voyager\b/, /\bdocuments? requis\b/, /\bquels? documents\b/,
      /\btravel documents\b/, /\brequired documents\b/, /\bwhat documents\b/,
      /\bki document lagbe\b/, /\bkagoj lagbe\b/, /\bki ki lagbe\b/,
      /কী কী দরকার/, /কোন কাগজ লাগবে/
    ],
    flowTarget: 'visa_docs', submenuHint: 'sub_docs'
  },
  {
    name: 'passeport', priority: 98, handoff: true,
    tests: [
      /\bpasseport\b/, /\bpasport\b/, /\bpassport\b/, /\bpassport valid\b/,
      /\bis my passport valid\b/, /\bpassport validity\b/,
      /\bpassport valid ache\b/, /\bpassport lagbe\b/, /\bpassport expire\b/,
      /\bpassport renew\b/, /\bpasport valid\b/, /\bpassport check\b/,
      /পাসপোর্ট বৈধ/, /পাসপোর্টের মেয়াদ/, /পাসপোর্ট চেক/
    ],
    flowTarget: 'visa_docs', submenuHint: 'sub_passport'
  },
  {
    name: 'omra_hajj', priority: 96, handoff: true,
    tests: [
      /\bomra\b/, /\bhajj\b/, /\bumrah\b/, /\bumra\b/,
      /\bomra korte chai\b/, /\bhajj er ticket\b/,
      /ওমরা/, /হজ/, /ওমরাহ/
    ],
    flowTarget: 'book_ticket'
  },
  {
    name: 'grossesse', priority: 95, handoff: true,
    tests: [
      /\bfemme enceinte\b/, /\benceinte\b/, /\bgrossesse\b/, /\bpregnant\b/, /\bpregnancy\b/,
      /\bgarbhaboti\b/, /\bgorbha\b/,
      /গর্ভবতী/, /গর্ভাবস্থা/
    ],
    flowTarget: 'visa_docs', submenuHint: 'sub_pregnancy'
  },
  {
    name: 'bebe_tarif', priority: 94, handoff: false,
    tests: [
      /\bbebe tarif\b/, /\btarif bebe\b/, /\btarif (?:pour |un )?bebe\b/,
      /\bbaby fare\b/, /\bbaby price\b/, /\bbaby ticket price\b/,
      /\bshishu ticket\b/, /\binfant ticket\b/,
      /শিশুর টিকেট/, /বাচ্চার ভাড়া/
    ],
    flowTarget: 'visa_docs', submenuHint: 'sub_baby'
  },
  {
    name: 'bebe_bagage', priority: 93, handoff: false,
    tests: [
      /\bbebe bagage\b/, /\bbagage bebe\b/, /\bbagage (?:pour |de )?bebe\b/,
      /\bbaby baggage\b/, /\bbaby luggage\b/, /\binfant baggage\b/,
      /\bbaby r bag\b/, /\bshishu r bag\b/,
      /শিশুর লাগেজ/, /বাচ্চার ব্যাগ/
    ],
    flowTarget: 'visa_docs', submenuHint: 'sub_baby'
  },
  {
    name: 'enfant_bagage', priority: 92, handoff: false,
    tests: [
      /\benfant bagage\b/, /\bbagage enfant\b/, /\bchild baggage\b/, /\bchild luggage\b/,
      /\bshishu bag\b/, /\bbackha bag\b/,
      /শিশুর ব্যাগের নিয়ম/
    ],
    flowTarget: 'visa_docs', submenuHint: 'sub_baby'
  },
  {
    name: 'demande_humain', priority: 90, handoff: true,
    tests: [
      /\bun agent\b/, /\bun conseiller\b/, /\bhumain\b/, /\bservice client\b/,
      /\bparler a un agent\b/, /\bparler a un conseiller\b/,
      /\bhuman\b/, /\bcustomer service\b/, /\bspeak to (?:a |an )?(?:agent|human|person)\b/,
      /\btalk to (?:a |an )?(?:agent|human|person)\b/,
      /\bagent er shathe kotha\b/, /\bmanush er sathe kotha\b/, /\badvisor lagbe\b/,
      /\bagent lagbe\b/, /\bkotha bolte chai\b/,
      /এজেন্টের সাথে কথা/, /মানুষের সাথে কথা বলব/
    ],
    flowTarget: 'agent'
  },
  {
    name: 'rappel_client', priority: 88, handoff: true,
    tests: [
      /\bappelez moi\b/, /\bappel moi\b/, /\bme rappeler\b/, /\bdemande de rappel\b/,
      /\bcall me\b/, /\bcall me back\b/, /\bcan you call me\b/,
      /\bcall diben\b/, /\bcall korun\b/, /\bphone diben\b/,
      /কল দিন/, /ফোন করুন/, /আমাকে কল করুন/
    ],
    flowTarget: 'agent'
  },
  {
    name: 'projet_voyage', priority: 85, handoff: true,
    tests: [
      /\bje veux (?:aller|voyager|partir)\b/, /\bje voudrais (?:aller|voyager|partir)\b/,
      /\bbil(?:l)?et\s+p(?:ou)?r\b/, /\bvol\s+p(?:ou)?r\b/,
      /\bpartir\s+(?:p(?:ou)?r|en|a|au|aux|vers)\b/, /\baller (?:au|aux|en|a)\b/,
      /\bi want (?:a |to )?ticket\b/, /\bi want to (?:go|travel|fly)\b/,
      /\bi need (?:a )?ticket\b/, /\bticket to\b/, /\bflight to\b/,
      /\bami ticket chai\b/, /\bamar ticket lagbe\b/, /\bticket lagbe\b/,
      /\bami dhaka jete chai\b/, /\bjete chai\b/, /\bjabo\b/, /\bzabo\b/,
      /আমি টিকেট চাই/, /আমার টিকেট লাগবে/, /আমি ঢাকা যেতে চাই/
    ],
    flowTarget: 'book_ticket'
  },
  {
    name: 'horaires_ouverture', priority: 80, handoff: false,
    tests: [
      /\bhoraire\b/, /\bhoraires\b/, /\bheures d ouverture\b/, /\bc quoi vos horaires\b/,
      /\bvous etes ouvert\b/, /\bopening hours\b/, /\bwhat time (?:do you )?open\b/,
      /\bare you open\b/, /\bopen today\b/, /\bbusiness hours\b/,
      /\bkokhon open\b/, /\bkobe open\b/, /\boffice khola\b/, /\bshomoy ki\b/,
      /কখন খোলা/, /অফিস কখন খোলে/, /সময় কত/
    ],
    flowTarget: null
  },
  {
    name: 'localisation_agences', priority: 75, handoff: false,
    tests: [
      /\badresse\b/, /\bou (?:etes|es) vous\b/, /\blocalisation\b/,
      /\bwhere are you\b/, /\blocation\b/, /\baddress\b/, /\bwhere is your office\b/,
      /\boffice kothay\b/, /\bkothay office\b/, /\baddress den\b/,
      /অফিস কোথায়/, /ঠিকানা দিন/
    ],
    flowTarget: null
  },
  {
    name: 'destination_couverte', priority: 70, handoff: false,
    tests: [
      /\bbangladesh\b/, /\binde\b/, /\bindia\b/, /\bsri lanka\b/, /\bmali\b/,
      /\bsenegal\b/, /\bguinee\b/, /\bguinea\b/, /\brdc\b/, /\bdr congo\b/,
      /\bdhaka\b/, /\bdakar\b/, /\bcolombo\b/, /\baccra\b/, /\bchittagong\b/, /\bsylhet\b/,
      /বাংলাদেশের টিকেট/, /ঢাকার টিকেট/
    ],
    flowTarget: 'price'
  },
  {
    name: 'promos', priority: 65, handoff: false,
    tests: [
      /\bpromo\b/, /\bpromos\b/, /\boffre speciale\b/, /\bspecial offer\b/,
      /\bdiscount\b/, /\bpromotion\b/, /\bpromo ache\b/, /\bkam damey\b/,
      /ছাড় আছে/, /প্রমো আছে/
    ],
    flowTarget: null
  },
  {
    name: 'bus', priority: 60, handoff: false,
    tests: [
      /\bbus\b/, /\btrain\b/, /\bfaites vous (?:le )?bus\b/,
      /\bbus ache\b/, /\btrain ache\b/
    ],
    flowTarget: null
  },
  {
    name: 'appel_non_repondu', priority: 58, handoff: false,
    tests: [
      /\bvous ne repondez pas\b/, /\bje n arrive pas a vous joindre\b/,
      /\bappel manque\b/, /\bpersonne ne repond\b/, /\bca repond pas\b/,
      /\bmissed call\b/, /\byou don t answer\b/,
      /\bfone dhoren na\b/, /\bphone receive hoyna\b/,
      /ফোন ধরছেন না/, /কল রিসিভ হয়নি/
    ],
    flowTarget: null
  },
  {
    name: 'agent_disponible', priority: 56, handoff: false,
    tests: [
      /\bagent disponible\b/, /\bconseiller disponible\b/, /\best quelqu un disponible\b/,
      /\bagent available\b/, /\bis (?:someone|anyone) available\b/,
      /\bagent free ache\b/, /\bkeu available\b/,
      /এজেন্ট আছেন/, /কেউ কি আছেন/
    ],
    flowTarget: null
  },
  {
    name: 'delai_reponse', priority: 54, handoff: false,
    tests: [
      /\bdelai de reponse\b/, /\bcombien de temps pour repondre\b/, /\bresponse time\b/,
      /\bkoto shomoy lage\b/, /\bkobe uttor pabo\b/,
      /কতক্ষণ লাগে/, /কখন উত্তর পাব/
    ],
    flowTarget: null
  },
  {
    name: 'duree_minimum', priority: 50, handoff: false,
    tests: [
      /\bduree minimum\b/, /\bminimum de jours\b/, /\bsejour minimum\b/,
      /\bminimum stay\b/, /\bminimum days\b/,
      /\bkoto din minimum\b/,
      /সর্বনিম্ন কতদিন/
    ],
    flowTarget: null
  },
  {
    name: 'remerciement', priority: 45, handoff: false,
    tests: [
      /\bmerci\b/, /\bmercii\b/, /\bmercie\b/, /\bmrc\b/,
      /\bthank you\b/, /\bthanks\b/, /\bthx\b/, /\bty\b/,
      /\bdonnobad\b/, /\bdhonnobad\b/, /\bshukriya\b/,
      /ধন্যবাদ/, /শুক্রিয়া/
    ],
    flowTarget: null
  },
  {
    name: 'ca_va', priority: 43, handoff: false,
    tests: [
      /\bca va\b/, /\bsa va\b/, /\bcomment ca va\b/, /\bcomment allez vous\b/,
      /\bhow are you\b/, /\bhow are u\b/,
      /\bkemon achen\b/, /\bkemon acho\b/,
      /কেমন আছেন/
    ],
    flowTarget: null
  },
  {
    name: 'salutation', priority: 41, handoff: false,
    tests: [
      /\bbonjour\b/, /\bsalut\b/, /\bcoucou\b/, /\bbonsoir\b/,
      /\bhello\b/, /\bhi\b/, /\bhey\b/, /\bgood morning\b/, /\bgood afternoon\b/,
      /\bnamaskar\b/, /\bnamaste\b/,
      /নমস্কার/, /হ্যালো/
    ],
    flowTarget: null
  },
  {
    name: 'salam', priority: 40, handoff: false,
    tests: [
      /\bsalam\b/, /\bsalam aleykoum\b/, /\bsalamaleykoum\b/, /\bsalamalaykoum\b/,
      /\bassalamoualaykoum\b/, /\bassalamualaikum\b/, /\bassalamu alaikum\b/,
      /আসসালামু আলাইকুম/, /সালাম/
    ],
    flowTarget: null
  },
  {
    name: 'au_revoir', priority: 38, handoff: false,
    tests: [
      /\bau revoir\b/, /\ba bientot\b/, /\bbonne journee\b/, /\bbonne soiree\b/,
      /\ba plus\b/, /\bbye\b/, /\bgoodbye\b/, /\bsee you\b/,
      /\bbiday\b/, /\bfir milenge\b/,
      /বিদায়/, /আল্লাহ হাফেজ/
    ],
    flowTarget: null
  }
].sort((a, b) => b.priority - a.priority);

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
    } catch (e) { /* ignorer */ }
  }
  return null;
}

module.exports = {
  normalizeText, hasBengaliScript, detectLanguage,
  isPhoneNumber, looksLikeReference, looksLikeContactInfo,
  extractTravelDestination, parseLeadingGreeting, prefixResponse,
  isResetCommand, detectIntent, INTENTS
};