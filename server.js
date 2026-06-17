const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// === DETECTION DE LA LANGUE ===
function detectLanguage(text = '') {
  const englishKeywords = [
    'hello', 'hi', 'hey', 'help', 'want', 'need', 'how', 'what', 'when', 'where',
    'which', 'please', 'thanks', 'thank', 'yes', 'no', 'flight', 'ticket', 'travel',
    'destination', 'date', 'price', 'booking', 'reservation', 'available', 'confirm',
    'cancel', 'modify', 'change', 'information', 'contact', 'phone', 'reference',
    'payment', 'visa', 'passport', 'documents', 'baby', 'pregnant', 'luggage',
    'baggage', 'quote'
  ];
  const normalized = String(text || '').toLowerCase();
  const words = normalized.split(/\s+/);
  let englishCount = 0;
  for (const word of words) {
    const cleaned = word.replace(/[^a-z]/g, '');
    if (englishKeywords.includes(cleaned)) englishCount++;
  }
  return englishCount >= 2 ? 'en' : 'fr';
}

// === TEXTES LOCALISES ===
const TEXTS = {
  fr: {
    unsupported_media: "Désolé, je ne peux pas traiter ce type de média ici.",
    handoff_ack: "Merci pour ces informations. Un conseiller AMI Voyages reprendra votre demande et vous recontactera dès que possible.",
    no_transcription: "Je n'ai pas réussi à transcrire l'audio. Pouvez-vous réessayer en texte ?",
    audio_error: "Erreur lors du traitement audio. Un agent prendra le relais si nécessaire.",
    empty_message: "Pouvez-vous me préciser votre demande ? Un agent AMI Voyages prendra ensuite le relais.",
    unknown_message: "Je n'ai pas pu traiter votre message. Un conseiller AMI Voyages va prendre la suite si besoin.",
  },
  en: {
    unsupported_media: "Sorry, I can't process this type of media here.",
    handoff_ack: "Thank you for this information. An AMI Voyages advisor will take over your request and contact you as soon as possible.",
    no_transcription: "I couldn't transcribe the audio. Could you try again with text?",
    audio_error: "An error occurred while processing the audio. An agent will take over if needed.",
    empty_message: "Could you clarify your request? An AMI Voyages agent will then assist you.",
    unknown_message: "I couldn't process your message. An AMI Voyages advisor will contact you if needed.",
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

// Stockage de session simple en memoire (memoire a court terme optionnelle)
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

// Un simple systeme de stockage en memoire pour eviter le traitement de messages webhook en double
const PROCESSED_MESSAGES = new Map(); // messageId -> timestamp

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

// Nettoyage periodique pour eviter une croissance illimitee de la memoire
setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of PROCESSED_MESSAGES) {
    if (now - ts > 15 * 60 * 1000) PROCESSED_MESSAGES.delete(id);
  }
}, 10 * 60 * 1000);

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
  const lower = String(text || '').toLowerCase();
  if (isPhoneNumber(lower)) return true;
  if (/\b(ref|reference|pnr|numero|billet)\b/.test(lower)) return true;
  if (looksLikeReference(lower) && /[0-9]/.test(lower)) return true;
  return false;
}

// Intentions granulaires (avec prise en charge bilingue fr/en)
const INTENTS = [
  {
    name: 'vol_annule_retarde', priority: 110, handoff: true,
    tests: [/\bvol\s+annule\b/i, /\bvol\s+retard\b/i, /\bannule\s+mon\s+vol\b/i, /\bflight\s+cancel(?:l)?ed\b/i, /\bflight\s+delay\b/i, /\bmy\s+flight\s+was\s+cancel(?:l)?ed\b/i],
    response: {
      fr: "Nous sommes désolés pour la gêne occasionnée.\nMerci d'indiquer votre référence de dossier, votre numéro de téléphone et le nom du passager, un conseiller prendra ensuite votre demande dès que possible.",
      en: "We are sorry for the inconvenience.\nPlease provide your booking reference, your phone number and the passenger's name; an advisor will assist you as soon as possible."
    }
  },
  {
    name: 'statut_confirmation_vol', priority: 105, handoff: true,
    tests: [/\bstatut\s+de\s+mon\s+vol\b/i, /\best[- ]ce\s+que\s+mon\s+vol\s+est\s+confirm/i, /\bmon\s+vol\s+est\s+confirm\b/i, /\bflight\s+status\b/i, /\bis\s+my\s+flight\s+confirm/i, /\bmy\s+flight\s+confirmation\b/i],
    response: {
      fr: "Merci de nous envoyer la référence de votre billet, le numéro de billet, la référence de votre facture ou la copie du passeport du passager, s'il vous plaît. Un conseiller AMI Voyages prendra ensuite le relais. Sinon vous pouvez regarder sur le site de la compagnie aérienne. Votre vol est avec quelle compagnie ?",
      en: "Please send us your ticket reference, ticket number, invoice reference or a copy of the passenger's passport. An AMI Voyages advisor will then assist you. Otherwise, you can check the airline's website. Which airline is your flight with?"
    }
  },
  {
    name: 'annulation_changement', priority: 103, handoff: true,
    tests: [/\bannuler\s+mon\s+billet\b/i, /\bannulation\b.*\bvol\b/i, /\bmodifier\s+mon\s+vol\b/i, /\bchanger\s+mon\s+vol\b/i, /\bcancel\s+my\s+ticket\b/i, /\bcancel(?:l)?ation\b/i, /\bmodify\s+my\s+flight\b/i, /\bchange\s+my\s+flight\b/i],
    response: {
      fr: "Les conditions d'annulation ou de modification dépendent du billet réservé, de la compagnie aérienne et des règles tarifaires. Si vous avez déjà un dossier, envoyez-nous votre référence et le nom du passager. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Cancellation or change conditions depend on the booked ticket, the airline and the fare rules. If you already have a booking, please send us your reference and the passenger's name. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'verification_dossier', priority: 102, handoff: true,
    tests: [/\bverif(?:ier|ication)\s+de\s+(?:mon\s+)?dossier\b/i, /\bstatut\s+de\s+mon\s+dossier\b/i, /\bverify\s+my\s+booking\b/i, /\bbooking\s+status\b/i],
    response: {
      fr: "Oui, un conseiller peut vérifier votre dossier.\nMerci d'indiquer votre référence de dossier ainsi que le nom du passager. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Yes, an advisor can check your booking.\nPlease provide your booking reference and the passenger's name. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'modification_billet_existant', priority: 101, handoff: true,
    tests: [/\bmodifier\s+le\s+billet\b/i, /\bchanger\s+la\s+date\s+du\s+vol\b/i, /\bmodifier\s+un\s+billet\s+existant\b/i, /\bmodify\s+the\s+ticket\b/i, /\bchange\s+flight\s+date\b/i],
    response: {
      fr: "Oui, cela doit être vérifié par un conseiller.\nMerci d'indiquer votre référence de dossier ainsi que votre demande de modification. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Yes, this needs to be checked by an advisor.\nPlease provide your booking reference and your change request. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'prix_disponibilite', priority: 100, handoff: true,
    tests: [/\b(prix|tarif)s?\b.*\b(disponib|disponibil)\b/i, /\bavez[- ]?vous\s+des\s+places\b/i, /\bprix\s+et\s+disponibilite\b/i, /\bcombien\s+ca\s+coute\b/i, /\bc\s+est\s+combien\b/i, /\bprix\s+billet\b/i, /\bvous\s+avez\s+des\s+tarifs\s+pour\b/i, /\bca\s+me\s+coutera\s+combien\b/i, /\bavez\s+vous\s+disponibilite\b/i, /\bhow\s+much\s+(?:is\s+)?(?:it|a\s+ticket)\b/i, /\bwhat\s+is\s+the\s+price\b/i],
    response: {
      fr: "Les prix varient selon la destination, la date, la compagnie aérienne et les places disponibles.\nMerci de nous indiquer :\nvotre destination,\nvotre ville de départ et votre ville de retour,\nvos dates de départ et de retour,\nle nombre de passagers,\nvotre préférence éventuelle : compagnie aérienne, vol direct ou prix le plus bas.\nUn conseiller AMI Voyages vous assistera ensuite.",
      en: "Prices vary depending on the destination, date, airline and seat availability.\nPlease let us know:\nyour destination,\nyour departure and return city,\nyour departure and return dates,\nthe number of passengers,\nyour preference if any: airline, direct flight or lowest price.\nAn AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'devis', priority: 99, handoff: true,
    tests: [/\bdevis\b/i, /\bje\s+veux\s+un\s+devis\b/i, /\bbesoin\s+de\s+devis\b/i, /\bquote\b/i, /\bi\s+(?:want|need)\s+a\s+quote\b/i],
    response: {
      fr: "Oui, nous pouvons transmettre votre demande à un conseiller.\nMerci d'indiquer :\nvotre destination,\nvotre ville de départ et votre ville de retour,\nvos dates,\nle nombre de passagers,\nvotre numéro de téléphone. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Yes, we can forward your request to an advisor.\nPlease provide:\nyour destination,\nyour departure and return city,\nyour dates,\nthe number of passengers,\nyour phone number. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'paiement_conditions', priority: 98, handoff: true,
    tests: [/\b(moyens|conditions?)\s+de\s+paiement\b/i, /\bmodalit\w*\s+de\s+paiement\b/i, /\bcomment\s+payer\b/i, /\bpayment\s+method\b/i, /\bpayment\s+option\b/i, /\bhow\s+do\s+i\s+pay\b/i],
    response: {
      fr: "Nous acceptons les virements bancaires, les espèces, les chèques ANCV, ainsi que les chèques-vacances / Connect.\nNous pouvons aussi vous envoyer un lien de paiement en ligne.\nSelon le dossier, un paiement en plusieurs fois peut être possible, sous condition.",
      en: "We accept bank transfers, cash, ANCV vouchers, as well as holiday vouchers / Connect.\nWe can also send you an online payment link.\nDepending on the booking, payment in installments may be possible, under certain conditions."
    }
  },
  {
    name: 'paiement_distance', priority: 97, handoff: true,
    tests: [/\bpaiement\s+a\s+distance\b/i, /\bpaiement\s+en\s+ligne\b/i, /\btelepaiement\b/i, /\bonline\s+payment\b/i, /\bremote\s+payment\b/i],
    response: {
      fr: "Selon le dossier, un paiement à distance est possible par carte bancaire via un lien de paiement sécurisé.\nMerci de nous envoyer votre facture d'achat, ou à défaut la copie du passeport du passager. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Depending on the booking, remote payment by card via a secure payment link is possible.\nPlease send us your invoice, or failing that, a copy of the passenger's passport. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'lien_paiement', priority: 97, handoff: true,
    tests: [/\blien\s+de\s+paiement\b/i, /\benvoyer\s+un\s+lien\s+de\s+paiement\b/i, /\bpayment\s+link\b/i, /\bsend\s+(?:me\s+)?a\s+payment\s+link\b/i],
    response: {
      fr: "Merci de nous envoyer votre facture d'achat, ou à défaut la copie du passeport du passager. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Please send us your invoice, or failing that, a copy of the passenger's passport. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'visa', priority: 96, handoff: true,
    tests: [/\bvisa\b/i, /\bdemande\s+de\s+visa\b/i, /\bvisa\s+pour\b/i, /\bvisa\s+application\b/i, /\bvisa\s+for\b/i],
    response: {
      fr: "Oui, nous proposons une assistance visa pour certaines destinations uniquement.\nIndiquez-nous votre destination et votre nationalité afin de vérifier si nous pouvons vous aider. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Yes, we offer visa assistance for certain destinations only.\nPlease tell us your destination and your nationality so we can check if we can help. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'documents_voyage', priority: 95, handoff: true,
    tests: [/\bdocuments?\s+pour\s+voyager\b/i, /\bdocuments?\s+requis\b/i, /\bpasseport\b.*\bvalide\b/i, /\bquels?\s+(documents|papiers)\b/i, /\btravel\s+documents\b/i, /\brequired\s+documents\b/i, /\bpassport\s+valid\b/i, /\bwhat\s+documents\b/i],
    response: {
      fr: "Les documents nécessaires dépendent de la destination, de votre nationalité et du type de voyage.\nIndiquez-nous votre destination et votre nationalité afin que nous puissions vous orienter. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Required documents depend on the destination, your nationality and the type of trip.\nPlease tell us your destination and your nationality so we can guide you. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'omra_hajj', priority: 94, handoff: true,
    tests: [/\bomra\b/i, /\bhajj\b/i, /\bomra\s+et\s+hajj\b/i, /\bumrah\b/i],
    response: {
      fr: "Oui, nous pouvons vous accompagner pour les voyages omra et hajj selon la période et les disponibilités.\nSi vous souhaitez connaître les tarifs, merci de nous indiquer :\nvotre destination,\nvotre ville de départ et votre ville de retour,\nvos dates de départ et de retour,\nle nombre de passagers. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Yes, we can assist you with Umrah and Hajj trips depending on the period and availability.\nIf you'd like to know the prices, please tell us:\nyour destination,\nyour departure and return city,\nyour departure and return dates,\nthe number of passengers. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'grossesse', priority: 93, handoff: true,
    tests: [/\bfemme\s+enceinte\b/i, /\bgrossesse\b.*\bvoyage\b/i, /\benceinte\b/i, /\bpregnant\b/i, /\bpregnancy\b/i],
    response: {
      fr: "Les femmes enceintes peuvent généralement voyager jusqu'à 6 mois.\nAu-delà, une autorisation médicale est requise, sous réserve d'acceptation par la compagnie aérienne et les services aéroportuaires. Vous pouvez également consulter votre médecin.",
      en: "Pregnant women can generally travel up to 6 months.\nBeyond that, a medical authorization is required, subject to acceptance by the airline and airport services. You can also check with your doctor."
    }
  },
  {
    name: 'bebe_tarif', priority: 92, handoff: true,
    tests: [/\bbebe\s+tarif\b/i, /\btarif\s+pour\s+un\s+bebe\b/i, /\btarif\s+bebe\b/i, /\bbaby\s+fare\b/i, /\bbaby\s+price\b/i],
    response: {
      fr: "De 1 jour à moins de 2 ans, le passager est considéré dans la catégorie bébé.\nIl paie généralement les taxes aéroport, selon les conditions du billet.\nÀ partir de 2 ans jusqu'à moins de 12 ans, il est considéré comme enfant.\nÀ partir de 12 ans, il est considéré comme adulte.",
      en: "From 1 day old to under 2 years, the passenger is considered a baby.\nThey generally pay airport taxes, depending on the ticket conditions.\nFrom 2 years to under 12 years, they are considered a child.\nFrom 12 years old, they are considered an adult."
    }
  },
  {
    name: 'bebe_bagage', priority: 92, handoff: true,
    tests: [/\bbebe\s+bagage\b/i, /\bbagage\s+pour\s+bebe\b/i, /\bbagage\s+de\s+bebe\b/i, /\bbaby\s+baggage\b/i, /\bbaby\s+luggage\b/i],
    response: {
      fr: "Oui, en général, ils ont droit aux bagages.\nCela dépend de la compagnie aérienne.\nSauf chez Saudia Airlines, où c'est 23 kilos.",
      en: "Yes, generally they are entitled to baggage.\nThis depends on the airline.\nExcept for Saudia Airlines, where it's 23 kilos."
    }
  },
  {
    name: 'enfant_bagage', priority: 92, handoff: true,
    tests: [/\benfant\s+bagage\b/i, /\bbagage\s+enfant\b/i, /\bbagage\s+pour\s+enfant\b/i, /\bchild\s+baggage\b/i, /\bchild\s+luggage\b/i],
    response: {
      fr: "Les bagages pour les enfants suivent généralement les mêmes normes que pour les adultes mais cela peut dépendre de la compagnie aérienne.",
      en: "Baggage for children generally follows the same rules as for adults, but this may depend on the airline."
    }
  },
  {
    name: 'rappel_client', priority: 91, handoff: true,
    tests: [/\bpouvez[- ]?vous\s+me\s+rappeler\b/i, /\bme\s+rappeler\b/i, /\bdemande\s+de\s+rappel\b/i, /\bcall\s+me\s+back\b/i, /\bcan\s+you\s+call\s+me\b/i],
    response: {
      fr: "Oui, nous pouvons transmettre votre demande à un conseiller.\nMerci d'indiquer votre nom et le sujet de votre demande. Un conseiller AMI Voyages prendra le relais.",
      en: "Yes, we can forward your request to an advisor.\nPlease provide your name and the subject of your request. An AMI Voyages advisor will take over."
    }
  },
  {
    name: 'demande_humain', priority: 90, handoff: true,
    tests: [/\bje\s+veux\s+parler\s+a\s+un\s+agent\b/i, /\bje\s+veux\s+parler\s+a\s+un\s+conseiller\b/i, /\bje\s+veux\s+parler\s+a\s+quelqu['’]?un\b/i, /\bun\s+agent\b/i, /\bun\s+conseiller\b/i, /\bhumain\b/i, /\bservice\s+client\b/i, /\bappelez[- ]?moi\b/i, /\bi\s+want\s+to\s+speak\s+to\s+(?:an\s+)?agent\b/i, /\bspeak\s+to\s+(?:a\s+)?human\b/i, /\bcustomer\s+service\b/i],
    response: {
      fr: "Bien sûr. Merci de nous indiquer votre nom, votre numéro de téléphone et l'objet de votre demande. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "Of course. Please provide your name, your phone number and the subject of your request. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'projet_voyage', priority: 79, handoff: true,
    tests: [/\bje\s+veux\s+(?:aller|voyager|partir)\b/i, /\bj['’]?\s*aimerais\s+aller\b/i, /\bje\s+voudrais\s+aller\b/i, /\bje\s+voudrais\s+voyager\b/i, /\bje\s+souhaite\s+aller\b/i, /\bje\s+souhaite\s+voyager\b/i, /\bje\s+souhaite\s+partir\b/i, /\bje\s+veux\s+partir\b/i, /\bje\s+veux\s+voyager\b/i, /\bje\s+veux\s+un\s+billet\s+pour\b/i, /\bje\s+cherche\s+un\s+billet\s+pour\b/i, /\bje\s+veux\s+reserver\s+un\s+vol\s+pour\b/i, /\bje\s+cherche\b.*\b(?:vol|voyage|billet)\b/i, /\bbillet\s+pour\b/i, /\bvol\s+pour\b/i, /\bje\s+pars\b/i, /\bpartir\s+(?:pour|en|a|au|aux|vers)\b/i, /\bvoyager\s+(?:pour|en|a|au|aux|vers)\b/i, /\baller\s+au\b/i, /\baller\s+aux\b/i, /\baller\s+vers\b/i, /\bi\s+(?:want|would\s+like)\s+to\s+(?:go|travel)\s+to\b/i, /\btravel\s+to\b/i, /\bticket\s+to\b/i],
    response: {
      fr: "Nous pouvons vous aider à organiser votre voyage. Merci de nous indiquer votre destination, votre ville de départ, vos dates de départ et de retour, et le nombre de passagers. Un conseiller AMI Voyages prendra ensuite le relais.",
      en: "We can help you organize your trip. Please tell us your destination, departure city, departure and return dates, and the number of passengers. An AMI Voyages advisor will then assist you."
    }
  },
  {
    name: 'horaires_ouverture', priority: 80, handoff: false,
    tests: [/\bhoraire\s+ouverture\b/i, /\bhoraires?\b.*\bouverture\b/i, /\bquels\s+sont\s+vos\s+horaires\b/i, /\bvous\s+etes\s+ouvert\b/i, /\bvous\s+etes\s+ouvert\s+quand\b/i, /\bcest\s+ouvert\b/i, /\bouvrez\s+quand\b/i, /\bfermez\s+a\s+quelle\s+heure\b/i, /\btravaillez\s+aujourd['’]?hui\b/i, /\bvous\s+etes\s+la\b/i, /\bouvert\s+demain\b/i, /\bopening\s+hours\b/i, /\bwhat\s+time\s+(?:do\s+you\s+)?open\b/i, /\bwhat\s+time\s+(?:do\s+you\s+)?close\b/i, /\bare\s+you\s+open\b/i],
    response: {
      fr: "Nos horaires sont les suivants :\nAMI Voyages Paris Gare du Nord, 157 rue Lafayette, 75010 Paris, ouvert du lundi au samedi de 10h00 à 18h30.\nAMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République, 93300 Aubervilliers, ouvert du mardi au vendredi de 10h00 à 18h30.\nVous pouvez aussi nous écrire ici sur WhatsApp.",
      en: "Our opening hours are as follows:\nAMI Voyages Paris Gare du Nord, 157 rue Lafayette, 75010 Paris, open Monday to Saturday from 10:00am to 6:30pm.\nAMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République, 93300 Aubervilliers, open Tuesday to Friday from 10:00am to 6:30pm.\nYou can also write to us here on WhatsApp."
    }
  },
  {
    name: 'localisation_agences', priority: 75, handoff: false,
    tests: [/\blocalisation\b.*\bagence\b/i, /\badresse\b.*\bagence\b/i, /\b(?:agence|adresse|ami\s+voyages)\b.*\bparis\b/i, /\b(?:agence|adresse|ami\s+voyages)\b.*\baubervilliers\b/i, /\bvous\s+etes\s+ou\b/i, /\bou\s+se\s+trouve\s+votre\s+agence\b/i, /\badresse\s+paris\b/i, /\badresse\s+aubervilliers\b/i, /\bwhere\s+are\s+you\b/i, /\blocation\b/i, /\baddress\b/i],
    response: {
      fr: "Voici nos agences :\nAMI Voyages Paris Gare du Nord, 157 rue Lafayette, 75010 Paris, ouvert du lundi au samedi de 10h00 à 18h30.\nAMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République, 93300 Aubervilliers, ouvert du mardi au vendredi de 10h00 à 18h30.\nVous pouvez aussi nous écrire ici sur WhatsApp.",
      en: "Here are our branches:\nAMI Voyages Paris Gare du Nord, 157 rue Lafayette, 75010 Paris, open Monday to Saturday from 10:00am to 6:30pm.\nAMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la République, 93300 Aubervilliers, open Tuesday to Friday from 10:00am to 6:30pm.\nYou can also write to us here on WhatsApp."
    }
  },
  {
    name: 'destination_couverte', priority: 70, handoff: false,
    tests: [/\bbangladesh\b/i, /\binde\b/i, /\bsri\s+lanka\b/i, /\bmali\b/i, /\bsenegal\b/i, /\bguinee\b/i, /\brdc\b/i],
    response: {
      fr: "Oui, nous travaillons sur cette destination.\nMerci de nous indiquer :\nvotre ville de départ et votre ville de retour,\nvos dates de départ et de retour,\nle nombre de passagers,\nvotre préférence éventuelle : compagnie aérienne, vol direct ou prix le plus bas.\nUn agent vous indiquera le meilleur prix actuel.",
      en: "Yes, we work on this destination.\nPlease tell us:\nyour departure and return city,\nyour departure and return dates,\nthe number of passengers,\nyour preference if any: airline, direct flight or lowest price.\nAn agent will give you the best current price."
    }
  },
  {
    name: 'promos', priority: 65, handoff: false,
    tests: [/\bpromo[s]?\b/i, /\boffre[s]?\s+special/i, /\bfrance\b.*\blisbonne\b.*\bdhaka\b/i, /\blisbonne[- ]dhaka\b/i, /\bspecial\s+offer\b/i, /\bdiscount\b/i],
    response: {
      fr: "Oui, nous pouvons proposer des tarifs avantageux au départ de la France avec retour en France, ainsi que sur Lisbonne-Dhaka.\nNous pouvons également traiter d'autres destinations.\nLes meilleurs tarifs sont en général hors vacances et hors week-end.\nSi vous souhaitez connaître les tarifs, merci de nous indiquer :\nvotre destination,\nvotre ville de départ et votre ville de retour,\nvos dates de départ et de retour,\nle nombre de passagers,\nvotre préférence éventuelle : compagnie aérienne, vol direct ou prix le plus bas.\nUn agent vous indiquera le meilleur prix actuel.",
      en: "Yes, we can offer good rates departing from France with return to France, as well as on Lisbon-Dhaka.\nWe can also handle other destinations.\nThe best rates are usually outside holidays and weekends.\nIf you'd like to know the prices, please tell us:\nyour destination,\nyour departure and return city,\nyour departure and return dates,\nthe number of passengers,\nyour preference if any: airline, direct flight or lowest price.\nAn agent will give you the best current price."
    }
  },
  {
    name: 'bus', priority: 64, handoff: false,
    tests: [/\bfaites[- ]?vous.*bus\b/i, /\bbus\b/i, /\btrain\b/i, /\bdo\s+you\s+(?:offer|have)\s+bus\b/i, /\bbus\s+or\s+train\b/i],
    response: {
      fr: "Non, nous proposons uniquement des voyages aériens.\nNotre agence est spécialisée dans les destinations d'Asie du Sud, comme le Bangladesh, l'Inde et le Sri Lanka, ainsi que d'Afrique subsaharienne, comme le Mali, le Sénégal, la Guinée ou la RDC.",
      en: "No, we only offer air travel.\nOur agency specializes in South Asian destinations such as Bangladesh, India and Sri Lanka, as well as sub-Saharan African destinations such as Mali, Senegal, Guinea or the DRC."
    }
  },
  {
    name: 'appel_non_repondu', priority: 60, handoff: false,
    tests: [/\bvous\s+ne\s+repondez\s+pas\b/i, /\bje\s+n['’]?arrive\s+pas\s+a\s+vous\s+joindre\b/i, /\blignes?\s+sont\s+occupe(?:es)?\b/i, /\bje\s+vous\s+ai\s+appele\b/i, /\bvous\s+m['’]?avez\s+pas\s+repondu\b/i, /\bappel\s+manque\b/i, /\bpersonne\s+ne\s+repond\b/i, /\bjai\s+appele\b/i, /\bje\s+vous\s+appelle\s+depuis\s+ce\s+matin\b/i, /\bca\s+repond\s+pas\b/i, /\bon\s+me\s+repond\s+pas\b/i, /\bvous\s+repondez\s+jamais\b/i, /\byou\s+don['’]?t\s+answer\b/i, /\bi\s+can['’]?t\s+reach\s+you\b/i, /\bmissed\s+call\b/i],
    response: {
      fr: "Nous sommes désolés si vous n'avez pas reçu de réponse rapide.\nPouvez-vous nous préciser votre demande ou nous laisser votre numéro ? Un conseiller AMI Voyages vous reviendra dès que possible.",
      en: "We are sorry if you haven't received a quick response.\nCould you clarify your request or leave us your number? An AMI Voyages advisor will get back to you as soon as possible."
    }
  },
  {
    name: 'agent_disponible', priority: 58, handoff: false,
    tests: [/\bagent\s+disponible\b/i, /\bconseiller\s+disponible\b/i, /\best\s+quelqu['’]?un\s+disponible\b/i, /\bagent\s+available\b/i, /\bis\s+someone\s+available\b/i],
    response: {
      fr: "Tous nos agents sont disponibles selon leur planning. Nous faisons de notre mieux pour répondre dans les meilleurs délais pendant les horaires d'ouverture.\nEn dehors de ces horaires, vous pouvez déjà nous laisser votre demande ici sur WhatsApp.",
      en: "All our agents are available according to their schedule. We do our best to respond as quickly as possible during opening hours.\nOutside these hours, you can already leave your request here on WhatsApp."
    }
  },
  {
    name: 'delai_reponse', priority: 55, handoff: false,
    tests: [/\bdelai\s+de\s+reponse\b/i, /\bcombien\s+de\s+temps\s+pour\s+repondre\b/i, /\ben\s+combien\s+de\s+temps\b/i, /\bresponse\s+time\b/i, /\bhow\s+long\s+to\s+respond\b/i],
    response: {
      fr: "Nous faisons de notre mieux pour répondre dans les meilleurs délais pendant les horaires d'ouverture.\nEn dehors de ces horaires, vous pouvez déjà nous laisser votre demande ici sur WhatsApp.",
      en: "We do our best to respond as quickly as possible during opening hours.\nOutside these hours, you can already leave your request here on WhatsApp."
    }
  },
  {
    name: 'duree_minimum', priority: 50, handoff: false,
    tests: [/\bduree\s+minimum\b/i, /\bminimum\s+de\s+jours\b/i, /\bsejour\s+minimum\b/i, /\bminimum\s+stay\b/i, /\bminimum\s+days\b/i],
    response: {
      fr: "En Asie, c'est généralement 5 à 7 jours.\nEn Afrique, c'est généralement 3 jours, selon la compagnie aérienne.",
      en: "In Asia, it's generally 5 to 7 days.\nIn Africa, it's generally 3 days, depending on the airline."
    }
  },
  {
    name: 'remerciement', priority: 42, handoff: false,
    tests: [/\bmerci\b/i, /\bmerci\s+beaucoup\b/i, /\bmercie?\s+a\s+vous\b/i, /\bok\s+merci\b/i, /\bdaccord\s+merci\b/i, /\bgrand\s+merci\b/i, /\bmercii+\b/i, /\bmrc\s+bcp\b/i, /\bmrc\b/i, /\bthank\s+you\b/i, /\bthanks\s+a\s+lot\b/i, /\bthx\b/i],
    response: {
      fr: "Avec plaisir. Je reste à votre disposition pour votre voyage.",
      en: "You're welcome. I remain available to help with your trip."
    }
  },
  {
    name: 'au_revoir', priority: 41, handoff: false,
    tests: [/\bau\s+revoir\b/i, /\ba\s+bientot\b/i, /\bbye\b/i, /\bbonne\s+journee\b/i, /\bbonne\s+soiree\b/i, /\ba\s+plus\b/i, /\bon\s+se\s+recontacte\b/i, /\bgoodbye\b/i, /\bsee\s+you\b/i, /\bsee\s+you\s+soon\b/i],
    response: {
      fr: "Merci pour votre message. À bientôt chez AMI Voyages.",
      en: "Thank you for your message. See you soon at AMI Voyages."
    }
  },
  {
    name: 'politesse_ca_va', priority: 41, handoff: false,
    tests: [/\b(?:ca|sa)\s+va\b/i, /\bsava\b/i, /\b(?:ca|sa)\s+roule\b/i, /\bca\s+baigne\b/i, /\bcomment\s+(?:ca|sa)\s+va\b/i, /\btu\s+va(?:s)?\s+bien\b/i, /\bvous\s+allez\s+bien\b/i, /\bcomment\s+va(?:s)?[- ]?tu\b/i, /\bcomment\s+tu\s+va(?:s)?\b/i, /\bcomment\s+allez[- ]?vous\b/i, /\bcomment\s+vous\s+allez\b/i, /\bquoi\s+de\s+neuf\b/i, /\bhow\s+are\s+you\b/i, /\bhow['’]?s\s+it\s+going\b/i],
    response: {
      fr: "Oui, ça va très bien, et vous ? Bienvenue chez AMI Voyages.\nNous sommes une agence de voyages spécialisée dans les vols en direction de l'Asie du Sud et de l'Afrique subsaharienne.\nEn quoi puis-je vous aider ?\nSi vous souhaitez connaître les tarifs, merci de nous indiquer :\nvotre destination,\nvotre ville de départ et votre ville de retour,\nvos dates de départ et de retour,\nle nombre de passagers,\nvotre préférence éventuelle : compagnie aérienne, vol direct ou prix le plus bas.\nUn agent vous indiquera le meilleur prix actuel.",
      en: "I'm doing very well, thank you, and you? Welcome to AMI Voyages.\nWe are a travel agency specializing in flights to South Asia and sub-Saharan Africa.\nHow can I help you?\nIf you'd like to know the prices, please tell us:\nyour destination,\nyour departure and return city,\nyour departure and return dates,\nthe number of passengers,\nyour preference if any: airline, direct flight or lowest price.\nAn agent will give you the best current price."
    }
  },
  {
    name: 'salutation', priority: 40, handoff: false,
    tests: [/\bbonjour\b/i, /\bsalut\b/i, /\bbjr\b/i, /\bhi\b/i, /\bhello\b/i, /\bslt\b/i, /\bgreetings\b/i],
    response: {
      fr: "Bonjour, bienvenue chez AMI Voyages.\nNous sommes une agence de voyages spécialisée dans les vols en direction de l'Asie du Sud et de l'Afrique subsaharienne.\nEn quoi puis-je vous aider ?\nSi vous souhaitez connaître les tarifs, merci de nous indiquer :\nvotre destination,\nvotre ville de départ et votre ville de retour,\nvos dates de départ et de retour,\nle nombre de passagers,\nvotre préférence éventuelle : compagnie aérienne, vol direct ou prix le plus bas.\nUn agent vous indiquera le meilleur prix actuel.",
      en: "Hello, welcome to AMI Voyages.\nWe are a travel agency specializing in flights to South Asia and sub-Saharan Africa.\nHow can I help you?\nIf you'd like to know the prices, please tell us:\nyour destination,\nyour departure and return city,\nyour departure and return dates,\nthe number of passengers,\nyour preference if any: airline, direct flight or lowest price.\nAn agent will give you the best current price."
    }
  },
  {
    name: 'salam', priority: 40, handoff: false,
    tests: [
      /\bslm\b/i,
      /\bsalam\b/i,
      /\bas\s+salam\s+alaik(?:oum|um)\b/i,
      /\bas\s+salam\s+aleyk(?:oum|um)\b/i,
      /\bas\s+salam\s+alayk(?:oum|um)\b/i,
      /\bassalam(?:u)?\s+alaik(?:oum|um)\b/i,
      /\bassalam(?:u)?\s+aleyk(?:oum|um)\b/i,
      /\bassalam(?:u)?\s+alayk(?:oum|um)\b/i,
      /\bsalam\s+alaik(?:oum|um)\b/i,
      /\bsalam\s+aleyk(?:oum|um)\b/i,
      /\bsalam\s+alayk(?:oum|um)\b/i,
      /\bsalam(?:a|u)?laik(?:oum|um)\b/i,
      /\bsalam(?:a|u)?leyk(?:oum|um)\b/i,
      /\bsalam(?:a|u)?layk(?:oum|um)\b/i
    ],
    response: {
      fr: "Walaikum assalam, bienvenue chez AMI Voyages.\nNous sommes une agence de voyages spécialisée dans les vols en direction de l'Asie du Sud et de l'Afrique subsaharienne.\nEn quoi puis-je vous aider ?\nSi vous souhaitez connaître les tarifs, merci de nous indiquer :\nvotre destination,\nvotre ville de départ et votre ville de retour,\nvos dates de départ et de retour,\nle nombre de passagers,\nvotre préférence éventuelle : compagnie aérienne, vol direct ou prix le plus bas.\nUn agent vous indiquera le meilleur prix actuel.",
      en: "Walaikum assalam, welcome to AMI Voyages.\nWe are a travel agency specializing in flights to South Asia and sub-Saharan Africa.\nHow can I help you?\nIf you'd like to know the prices, please tell us:\nyour destination,\nyour departure and return city,\nyour departure and return dates,\nthe number of passengers,\nyour preference if any: airline, direct flight or lowest price.\nAn agent will give you the best current price."
    }
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

function parseLeadingGreeting(text = '', lang = 'fr') {
  const normalized = normalizeText(text);
  const patterns = lang === 'en'
    ? [{ prefix: 'Hello', regex: /^(?:hello|hi|hey)\b[\s,]*(.*)$/ }]
    : [
        { prefix: 'Bonjour', regex: /^(?:bonjour|salut|bjr|slt)\b[\s,]*(.*)$/ },
        { prefix: 'Walaikum assalam', regex: /^(?:slm|salam(?:\s+(?:alaik|aleyk|alayk)(?:oum|um))?|salam(?:a|u)?(?:laik|leyk|layk)(?:oum|um)|as[-\s]+salam(?:u)?\s+(?:alaik|aleyk|alayk)(?:oum|um)|assalam(?:u)?\s+(?:alaik|aleyk|alayk)(?:oum|um))\b[\s,]*(.*)$/i }
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
    /\b(?:voyager\s+(?:pour|en|a|au|aux|vers)\s+([a-z][a-z\s]{1,60}))/,
    /\b(?:i\s+(?:want\s+)?(?:to\s+)?(?:go|travel)\s+to\s+([a-z][a-z\s]{1,60}))/,
    /\b(?:travel\s+to\s+([a-z][a-z\s]{1,60}))/,
    /\b(?:ticket\s+to\s+([a-z][a-z\s]{1,60}))/,
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
      // ignorer les erreurs d'expression reguliere
    }
  }
  return null;
}

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

app.get('/', (req, res) => {
  res.send("Le chatbot AMI Voyages est en cours d'execution");
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
  console.log(`Serveur en cours d'execution sur le port ${PORT}`);
});
