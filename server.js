const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// === DÃ‰TECTION DE LA LANGUE ===
fonction detectLanguage(texte = '') {
  const englishKeywords = [
    'bonjour', 'salut', 'aide', 'vouloir', 'besoin', 'comment', 'quoi', 'quand', 'oÃ¹', 'lequel', 'faites-vous',
    Â« pouvez - vous Â», Â« s'il vous plaÃ®t Â», Â« merci Â», Â« merci Â», Â« merci Â», Â« d'accord Â», Â« oui Â», Â« non Â», Â« vol Â», Â« billet Â»,
  'voyage', 'destination', 'date', 'prix', 'rÃ©servation', 'disponible', 'confirmer', 'annuler',
    'modifier', 'changer', 'informations', 'contact', 'tÃ©lÃ©phone', 'rÃ©fÃ©rence', 'paiement', 'visa',
    'passeport', 'documents', 'bÃ©bÃ©', 'enceinte', 'bagages', 'aller', 'voyager',
    Â« je veux Â», Â« j'ai besoin Â», Â« j'aimerais Â», Â« voudrais Â», Â« pourriez - vous Â», Â« pourriez - vous Â», Â« y a - t - il Â», Â« y a - t - il Â»
  ];
  const normalisÃ© = String(texte || '').toLowerCase();
  const mots = normalisÃ©.split(/\s+/);
  soit englishCount = 0;
  pour(const mot de mots) {
    const nettoyÃ© = mot.replace(/[^az]/g, '');
  si(englishKeywords.includes(cleaned)) englishCount++;
}
  retourner englishCount >= 1 ? 'en' : 'fr';
}

// === TEXTES LOCALISÃ‰S ===
const TEXTES = {
  fr: {
    unsupported_media: "DÃ©solÃ©, je ne peux pas traiter ce type de mÃ©dia ici.",
    handoff_ack: "Merci pour ces informations. Un conseiller AMI Voyages reprendra votre demande et vous recontactera vers que possible.",
    no_transcription: "Je n'ai pas rÃ©ussi Ã  transcrire l'audio. Pouvez-vous rÃ©essayer en texte ?",
    audio_error: "Erreur lors du traitement audio. Un agent prendra le relais si nÃ©cessaire.",
    empty_message: "Pouvez-vous me prÃ©ciser votre demande ? Un agent AMI Voyages prendra ensuite le relais.",
    unknown_message: "Je n'ai pas pu traiter votre message. Un conseiller AMI Voyages va prendre la suite si besoin.",
  },
  en: {
    mÃ©dia_non_pris_en_charge: Â« DÃ©solÃ©, je ne peux pas traiter ce type de mÃ©dia. Â»
    handoff_ack: "Merci pour ces informations. Un conseiller AMI Voyages prendra en charge votre demande et vous contactera dÃ¨s que possible."
    no_transcription: "Je n'ai pas pu transcrire l'audio. Pourriez-vous rÃ©essayer avec du texte ?",
    audio_error: "Erreur lors du traitement audio. Un agent prendra le relais si nÃ©cessaire.",
    empty_message: "Pourriez-vous prÃ©ciser votre demande ? Un agent d'AMI Voyages vous assistera ensuite.",
    Message inconnu: Â« Je nâ€™ai pas pu traiter votre message.Un conseiller dâ€™AMI Voyages vous contactera si nÃ©cessaire. Â»
  }
};

fonction t(lang = 'fr', clÃ© = '', vars = {}) {
  const text = TEXTS[lang]?.[key] || TEXTS['fr']?.[key] || '';
  soit rÃ©sultat = texte;
  pour(const [k, v] de Object.entries(vars)) {
    rÃ©sultat = rÃ©sultat.remplacer(`{${k}}`, v);
  }
  renvoyer le rÃ©sultat;
}

// Stockage de session simple en mÃ©moire (mÃ©moire Ã  court terme optionnelle)
const SESSIONS = new Map();

fonction saveSession(utilisateur, donnÃ©es) {
  const s = SESSIONS.get(user) || {};
  Objet.assigner(s, donnÃ©es);
  SESSIONS.set(utilisateur, s);
}

fonction getSession(utilisateur) {
  retourner SESSIONS.get(utilisateur) || {};
}

fonction clearSession(utilisateur) {
  SESSIONS.supprimer(utilisateur);
}

// Un simple systÃ¨me de stockage en mÃ©moire pour Ã©viter le traitement de messages webhook en double
const PROCESSED_MESSAGES = new Map(); // messageId -> timestamp

fonction isMessageProcessed(id, windowMs = 5 * 60 * 1000) {
  si(!id) retourner faux;
  const t = PROCESSED_MESSAGES.get(id);
  si(!t) retourner faux;
  si(Date.now() - t < windowMs) retourner vrai;
  MESSAGES_PROCESSÃ‰S.supprimer(id);
  renvoyer faux;
}

fonction markMessageProcessed(id) {
  si(!id) retourner;
  MESSAGES_PROCESSÃ‰S.set(id, Date.now());
}

// Nettoyage pÃ©riodique pour Ã©viter une croissance illimitÃ©e de la mÃ©moire
dÃ©finirInterval(() => {
  const maintenant = Date.maintenant();
  pour(const [id, ts] de PROCESSED_MESSAGES) {
  si(maintenant - ts > 15 * 60 * 1000) PROCESSED_MESSAGES.delete(id);
}
}, 10 * 60 * 1000);

fonction isPhoneNumber(texte) {
  si(!texte) retourner faux;
  const digits = String(text).replace(/\D/g, '');
  retourner digits.length >= 8 && digits.length <= 15;
}

fonction looksLikeReference(texte) {
  si(!texte) retourner faux;
  const s = String(texte || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  si(!/^[A-Z0-9]{6,10}$/.test(s)) retourner faux;
  si(!/[AZ]/.test(s) || !/[0-9]/.test(s)) retourner faux;
  const blacklist = ['CONTACT', 'REFERENCE', 'NUMERO', 'PHONE', 'TEL', 'AGENT'];
  pour(const b de la liste noire) si (s.includes(b)) retourner faux;
  renvoyer vrai;
}

fonction looksLikeContactInfo(texte) {
  const t = String(texte || '').toLowerCase();
  si(isPhoneNumber(t)) retourner vrai;
  si(/\b(ref|rÃ©f|reference|pnr|numÃ©ro|numÃ©ro|billet)\b/.test(t)) retourner vrai;
  si(looksLikeReference(t) && /[0-9]/.test(t)) retourner vrai;
  renvoyer faux;
}

// Intentions granulaires finales (dÃ©claration unique) - avec prise en charge bilingue
const INTENTS = [
  {
    nom: 'vol_annule_retarde', prioritÃ©: 110, transfert: vrai, tests: [/\bvol\s+annul(?:[ÃƒÂ©e])\b/i, /\bvol\s+retard\b/i, /\bannule\s+mon\s+vol\b/i, /\bflight\s+cancel(?:l)?ed\b/i, /\bflight\s+delay\b/i, /\bmy\s+flight\s+was\s+cancel(?:l)?ed\b/i], rÃ©ponse: {
      fr: 'Nous sommes dÃ©solÃ©s pour la gÃªne occasionnÃ©e.\nMerci d'indiquer votre rÃ©fÃ©rence de dossier, votre numÃ©ro de tÃ©lÃ©phone et le nom du passager, un conseiller prendra ensuite votre exiger dÃƒÂ¨s que possible.', en: 'Nous sommes dÃ©solÃ©s pour le dÃ©sagrÃ©ment.\nVeuillez fournir votre rÃ©fÃ©rence de rÃ©servation, votre numÃ©ro de tÃ©lÃ©phone et le nom du passager ; un conseiller vous assistera dÃ¨s que possible.' } },
  { nom: 'statut_confirmation_vol', prioritÃ©: 105, transfert: vrai, tests: [/\bstatut\s+de\s+mon\s+vol\b/i, /\best[- ]ce\s+que\s+mon\s+vol\s+est\s+confirm/i, /\bmon\s+vol\s+est\s+confirm\b/i, /\bflight\s+status\b/i, /\bis\s+my\s+flight\s+confirm/i, /\bmy\s+flight\s+confirmation\b/i], rÃ©ponse: { fr: 'Merci de nous envoyer la rÃ©fÃ©rence de votre billet, le numÃ©ro de billet, la rÃ©fÃ©rence de votre facture ou la copie du passeport du passager, s'il vous plaÃ®t.Un conseiller AMI Voyages prendra ensuite le relais.Sinon vous pouvez regarder sur le site des compagnies aÃ©riennes, Votre vol est avec quelles compagnies aÃ©riennes?', en: 'Veuillez nous envoyer la rÃ©fÃ©rence de votre billet, le numÃ©ro de billet, la rÃ©fÃ©rence de facture ou la copie du passeport passager.Un conseiller AMI Voyages vous assistera ensuite.Sinon, vous pouvez consulter le site Web de la compagnie aÃ©rienne.Avec quelle compagnie aÃ©rienne votre vol est- il effectuÃ©?}
    },
  {
    nom: 'annulation_changement', prioritÃ©: 103, transfert: vrai, tests: [/\bannuler\s+mon\s+billet\b/i, /\bannulation\b.*\bvol\b/i, /\bmodifier\s+mon\s+vol\b/i, /\bchanger\s+mon\s+vol\b/i, /\bcancel\s+my\s+ticket\b/i, /\bcancel(?:l)?ation\b/i, /\bmodify\s+my\s+flight\b/i, /\bchange\s+my\s+flight\b/i], rÃ©ponse: { fr: 'Les conditions d'annulation ou de modification dÃ©pendent du billet rÃ©servÃ©, de la compagnie aÃ©rienne et des rÃ¨gles tarifaires.\nSi vous avez dÃ©jÃ  un dossier, envoyez- nous votre Les conditions d'annulation ou de modification dÃ©pendent du billet rÃ©servÃ©, de la compagnie aÃ©rienne et des rÃ¨gles tarifaires. Si vous avez dÃ©jÃ  une rÃ©servation, veuillez nous communiquer votre rÃ©fÃ©rence ou votre numÃ©ro et le nom du passager. Un conseiller AMI Voyages vous assistera ensuite.
  { nom: 'verification_dossier', prioritÃ©: 102, handoff: true, tests: [/\bverif(?:ier|ication)\s+de\s+(?:mon\s+)?dossier\b/i, /\bstatut\s+de\s+mon\s+dossier\b/i, /\bverify\s+my\s+booking\b/i, /\bbooking\s+status\b/i], rÃ©ponse: { fr: 'Oui, un conseiller peut vÃ©rifier votre dossier.\nMerci d'indiquer votre rÃ©fÃ©rence de dossier ainsi que le nom du passager.Un conseiller AMI Voyages prendra ensuite le relais.', fr: 'Oui, un conseiller peut vÃ©rifier votre rÃ©servation.\nVeuillez fournir votre rÃ©fÃ©rence de rÃ©servation et le nom du passager.Un conseiller AMI Voyages vous assistera ensuite. } },
  {
    nom: 'modification_billet_existant', prioritÃ©: 101, handoff: true, tests: [/\bmodifier\s+le\s+billet\b/i, /\bchanger\s+la\s+date\s+du\s+vol\b/i, /\bmodifier\s+un\s+billet\s+existant\b/i, /\bmodify\s+the\s+ticket\b/i, /\bchange\s+flight\s+date\b/i], rÃ©ponse: {
      fr: 'Oui, cela doit Ãªtre vÃ©rifiÃ© par un conseiller.\nMerci d'indiquer votre rÃ©fÃ©rence de dossier ainsi que votre demande de modification.Un conseiller AMI Voyages prendra ensuite le relais.', fr: 'Oui, cela doit Ãªtre vÃ©rifiÃ© par un conseiller.\nVeuillez fournir votre rÃ©fÃ©rence de rÃ©servation et votre demande de modification.Un conseiller d'AMI Voyages vous assistera ensuite.
  { nom: 'prix_disponibilite', prioritÃ©: 100, handoff: true, tests: [/\b(prix|tarif)s?\b.*\b(disponib|disponibil)\b/i, /\bavez[- ]?vous\s+des\s+places\b/i, /\bprix\s+et\s+disponibilite\b/i, /\bcombien\s+ca\s+coute\b/i, /\bc\s+est\s+combien\b/i, /\bprix\s+billet\b/i, /\bvous\s+avez\s+des\s+tarifs\s+pour\b/i, /\bca\s+me\s+coutera\s+combien\b/i, /\bprix\s+et\s+disponibilitÃ©\b/i, /\bdo\s+vous\s+avez\s+disponibilitÃ©\b/i, /\bhow\s+much\s+(?:is\s+)?(?:it|a\s+ticket)\b/i, /\bwhat\s+is\s+the\s+price\b/i], rÃ©ponse: { fr: 'Les prix varient selon la destination, la date, la compagnie aÃ©rienne et les places disponibles.\nMerci de nous indiquer :\nvotre destination,\nvotre ville de dÃ©part et votre ville de retour,\nvos dates de dÃ©part et de retour,\nle nombre de passagers,\nvotre prÃ©fÃ©rence Ã©vÃ©nementielle : compagnie aÃ©rienne, vol direct ou prix le plus bas. Un conseiller AMI Voyages vous assistera ensuite. Les prix varient selon la destination, la date, la compagnie aÃ©rienne et les places disponibles. Veuillez nous indiquer : votre destination, vos villes de dÃ©part et de retour, vos dates de dÃ©part et de retour, le nombre de passagers et vos prÃ©fÃ©rences (compagnie aÃ©rienne, vol direct ou prix le plus bas). Un conseiller AMI Voyages vous assistera ensuite.
  { nom: 'devis', prioritÃ©: 99, transfert: vrai, tests: [/\bdevis\b/i, /\bje\s+veux\s+un\s+devis\b/i, /\bbesoin\s+de\s+devis\b/i, /\bquote\b/i, /\bi\s+(?:want|need)\s+a\s+quote\b/i], rÃ©ponse: { fr: 'Oui, nous pouvons transmettre votre demande Ã  un conseiller.\nMerci d'indiquer: \nvotre destination, \nvotre ville de dÃ©part et votre ville de retour, \nvos dates, \nle nombre de passagers, \nvotre numÃ©ro de tÃ©lÃ©phone.Un conseiller AMI Voyages prendra ensuite le relais.Oui, nous pouvons transmettre votre demande Ã  un conseiller.Veuillez indiquer: votre destination, vos villes de dÃ©part et de retour, vos dates, le nombre de passagers et votre numÃ©ro de tÃ©lÃ©phone.Un conseiller AMI Voyages vous assistera ensuite.
  { nom: 'paiement_conditions', prioritÃ©: 98, transfert: true, tests: [/\b(moyens|conditions?)\s+de\s+paiement\b/i, /\bmodalit\w*\s+de\s+paiement\b/i, /\bcomment\s+payer\b/i, /\bpayment\s+method\b/i, /\bpayment\s+option\b/i, /\bhow\s+do\s+i\s+pay\b/i], rÃ©ponse: { fr: 'Nous acceptons les virements bancaires, les espÃ¨ces, les chÃ¨ques ancv, ainsi que les chÃ¨ques-vacances / Connect.\nNous pouvons aussi vous envoyer un lien de paiement en ligne.\nSelon le dossier, un paiement en plusieurs fois peut Ãªtre possible, sous condition.', fr: 'Nous acceptons les virements bancaires, les espÃ¨ces, VÃ©rifications ANCV et vÃ©rifications de vacances / Connect.\nNous pouvons Ã©galement vous envoyer un lien de paiement en ligne.\nSelon la rÃ©servation, un paiement en plusieurs fois peut Ãªtre possible, sous certaines conditions.
  {
    nom: 'paiement_distance', prioritÃ©: 97, handoff: true, tests: [/\bpaiement\s+a\s+distance\b/i, /\bpaiement\s+en\s+ligne\b/i, /\btelepaiement\b/i, /\bonline\s+payment\b/i, /\tremote\s+payment\b/i], rÃ©ponse: {
      fr: 'Selon le dossier, un paiement Ã  distance est possible par carte bancaire via un lien de paiement sÃ©curisÃ©.\nMerci de nous indiquer votre facture d'achat, ou Ã  dÃ©faut la copie du passeport du passager.Un conseiller AMI Voyages prendra ensuite le relais.', fr: 'En fonction de la rÃ©servation, un paiement Ã  distance par carte bancaire via un lien de paiement sÃ©curisÃ© est possible.\nVeuillez nous envoyer votre facture, ou Ã  dÃ©faut, une copie du passeport du passager.Un conseiller d'AMI Voyages vous assistera ensuite.
  { nom: 'lien_paiement', prioritÃ©: 97, handoff: true, tests: [/\blien\s+de\s+paiement\b/i, /\benvoyer\s+un\s+lien\s+de\s+paiement\b/i, /\bpayment\s+link\b/i, /\bsend\s+(?:me\s+)?a\s+payment\s+link\b/i], rÃ©ponse: { fr: 'Merci de nous indiquer votre facture d'achat, ou Ã  dÃ©faut la copie du passeport du passager.Un conseiller AMI Voyages prendra ensuite le relais.', fr: 'Veuillez nous envoyer votre facture, ou Ã  dÃ©faut, une copie du passeport du passager.Un conseiller AMI Voyages vous assistera ensuite. } },
  { nom: 'visa', prioritÃ©: 96, handoff: true, tests: [/\bvisa\b/i, /\bdemande\s+de\s+visa\b/i, /\bvisa\s+pour\b/i, /\bvisa\s+application\b/i, /\bvisa\s+for\b/i], rÃ©ponse: { fr: 'Oui, nous proposons une assistance visa pour certaines destinations uniquement.\nIndiquez-nous votre destination et votre nationalitÃ© afin de vÃ©rifier si nous pouvons vous aider. Un conseiller AMI Voyages prendra ensuite le relais.', fr: 'Oui, nous proposons une assistance visa pour certaines destinations uniquement.\nVeuillez nous indiquer votre destination et votre nationalitÃ© afin que nous puissions vÃ©rifier si nous pouvons vous aider. Un conseiller AMI Voyages vous assistera ensuite. } },
  { nom: 'documents_voyage', prioritÃ©: 95, handoff: true, tests: [/\bdocuments?\s+pour\s+voyager\b/i, /\bdocuments?\s+requis\b/i, /\bpasseport\b.*\bvalide\b/i, /\bquels?\s+(documents|papiers)\b/i, /\btravel\s+documents\b/i, /\brequired\s+documents\b/i, /\bpassport\s+valid\b/i, /\bwhat\s+documents\b/i], rÃ©ponse: { fr: 'Les documents nÃ©cessaires dÃ©pendent de la destination, de votre nationalitÃ© et du type de voyage.\nIndiquez-nous votre destination et votre nationalitÃ© afin que nous puissions vous orienter. Un conseiller AMI Voyages prendra ensuite le relais. Les documents requis dÃ©pendent de votre destination, de votre nationalitÃ© et du type de voyage. Veuillez nous indiquer votre destination et votre nationalitÃ© afin que nous puissions vous guider. Un conseiller AMI Voyages vous assistera ensuite.
  { nom: 'omra_hajj', prioritÃ©: 94, handoff: true, tests: [/\bomra\b/i, /\bhajj\b/i, /\bomra\s+et\s+hajj\b/i, /\bumrah\b/i], rÃ©ponse: { fr: 'Oui, nous pouvons vous accompagner pour les voyages omra et hajj selon la pÃ©riode et les disponibilitÃ©s.\nSi vous souhaitez connaÃ®tre les tarifs, merci de nous indiquer :\nvotre destination,\nvotre ville de dÃ©part et votre ville de retour,\nvos dates de dÃ©part et de retour,\nle nombre de passagers. Un conseiller AMI Voyages prendra ensuite le relais.', en: 'Yes we can assist you with Umrah and Hajj trips according to the period and availability.\nIf you want to know the prices please tell us:\nyour destination,\nyour start and return city,\nyour start and return dates,\nnumber passenger. An AMI Voyages advisor will then assist you.' } },
  { nom: 'grossesse', prioritÃ©: 93, handoff: true, tests: [/\bfemme\s+enceinte\b/i, /\bgrossesse\b.*\bvoyage\b/i, /\benceinte\b/i, /\bpregnant\b/i, /\bpregnancy\b/i], rÃ©ponse: { fr: 'Les femmes enceintes peuvent voyager en gÃ©nÃ©ral jusqu'Ã  6 mois.\nAu- delÃ , il faut une autorisation mÃ©dicale, sous rÃ©serve d'acceptation de la compagnie aÃ©rienne et des services aÃ©roportuaires. Vous pouvez Ã©galement demander Ã  votre mÃ©decin.', fr: 'Les femmes enceintes peuvent gÃ©nÃ©ralement voyager jusqu'Ã  6 mois.\nAu- delÃ , une autorisation mÃ©dicale est requise, sous rÃ©serve d'acceptation par la compagnie aÃ©rienne et les services aÃ©roportuaires. Vous pouvez Ã©galement consulter votre mÃ©decin. } },
  { nom: 'bebe_tarif', prioritÃ©: 92, handoff: true, tests: [/\bbebe\s+tarif\b/i, /\btarif\s+pour\s+un\s+bebe\b/i, /\btarif\s+bebe\b/i, /\bbaby\s+fare\b/i, /\bbaby\s+price\b/i], rÃ©ponse: { fr: 'De 1 jour Ã  moins de 2 ans, le passager est considÃ©rÃ© dans la catÃ©gorie bÃ©bÃ©.\nIl paie gÃ©nÃ©ralement les taxes aÃ©roport, selon les conditions du billet.\nÃ  partir de 2 ans jusqu'Ã  moins de 12 ans, il est considÃ©rÃ© comme enfant.\nÃ  partir de 12 ans, il est considÃ©rÃ© comme adulte.', en: 'De 1 jour Ã  moins de 2 ans, le passager est considÃ©rÃ© comme un bÃ©bÃ©.\nIls paient gÃ©nÃ©ralement des taxes d'aÃ©roport, selon les conditions du billet.\nDe 2 ans Ã  moins de 12 ans, ils sont considÃ©rÃ©s comme un enfant.\nÃ€ partir de 12 ans, ils sont considÃ©rÃ©s comme un adulte.' } },
  {
    nom: 'bebe_bagage', prioritÃ©: 92, handoff: true, tests: [/\bbebe\s+bagage\b/i, /\bbagage\s+pour\s+bebe\b/i, /\bbagage\s+de\s+bebe\b/i, /\bbaby\s+baggage\b/i, /\bbaby\s+luggage\b/i], rÃ©ponse: {
      fr: 'Oui, en gÃ©nÃ©ral, ils ont droit aux bagages.\nCela dÃ©pend de la compagnie aÃ©rienne.\nSauf chez Saudia Airlines, oÃƒÂ¹ c'est 23 kilos.', fr: 'Oui, gÃ©nÃ©ralement ils ont droit aux bagages.\nÃ‡a dÃ©pend de la compagnie aÃ©rienne.\nSauf pour Saudia Airlines, qui est de 23 kilos.' } },
  { nom: 'enfant_bagage', prioritÃ©: 92, handoff: true, tests: [/\benfant\s+bagage\b/i, /\bbagage\s+enfant\b/i, /\bbagage\s+pour\s+enfant\b/i, /\bchild\s+baggage\b/i, /\bchild\s+luggage\b/i], rÃ©ponse: { fr: 'Les bagages pour les enfants suivent gÃ©nÃ©ralement les mÃªmes normes que pour les adultes mais cela peut dÃ©pendre de la compagnie aÃ©rienne.', fr: 'Les bagages des enfants suivent gÃ©nÃ©ralement les mÃªmes rÃ¨gles que ceux des adultes mais peuvent dÃ©pendre de la compagnie aÃ©rienne.' } },
  {
    nom: 'rappel_client', prioritÃ©: 91, handoff: true, tests: [/\bpouvez[- ]?vous\s+me\s+rappeler\b/i, /\bme\s+rappeler\b/i, /\bdemande\s+de\s+rappel\b/i, /\bcall\s+me\s+back\b/i, /\bcan\s+you\s+call\s+me\b/i], rÃ©ponse: {
      fr: 'Oui, nous pouvons transmettre votre demande Ã  un conseiller.\nMerci d'indiquer votre nom et le sujet de votre demande.Un conseiller AMI Voyages prendra le relais.', fr: 'Oui, nous pouvons transmettre votre demande Ã  un conseiller.\nVeuillez indiquer votre nom et l'objet de votre demande. Un conseiller AMI Voyages prendra le relais. } },
  { nom: 'projet_voyage', prioritÃ©: 79, handoff: true, tests: [/\bje\s+veux\s+(?:aller|voyager|partir)\b/i, /\bj\s*['']?\s*aimerais\s+aller\b/i, /\bje\s+voudrais\s+aller\b/i, /\bje\s+voudrais\s+voyager\b/i, /\bje\s+souhaite\s+aller\b/i, /\bje\s+souhaite\s+voyager\b/i, /\bje\s+souhaite\s+partir\b/i, /\bje\s+veux\s+partir\b/i, /\bje\s+veux\s+voyager\b/i, /\bje\s+veux\s+un\s+billet\s+pour\b/i, /\bje\s+cherche\s+un\s+billet\s+pour\b/i, /\bje\s+veux\s+reserver\s+un\s+vol\s+pour\b/i, /\bje\s+cherche\b.*\b(?:vol|voyage|billet)\b/i, /\bbillet\s+pour\b/i, /\bvol\s+pour\b/i, /\bje\s+pars\b/i, /\bpartir\s+(?:pour|en|a|au|aux|vers)\b/i, /\bvoyager\s+(?:pour|en|a|au|aux|vers)\b/i, /\baller\s+au\b/i, /\baller\s+aux\b/i, /\baller\s+vers\b/i, /\bi\s+(?:vouloir|besoin)\s+(?:vers\s+aller|vers\s+voyage)\b/i, /\bi\s+(?:vouloir|aimer)\s+a\s+(?:vol|billet|voyage)\s+vers\b/i, /\bi\s+(?:want|like)\s+to\s+(?:go|travel)\s+to\b/i, /\btravel\s+to\b/i, /\bticket\s+to\b/i], rÃ©ponse: { fr: 'Nous pouvons vous aider Ã  organiser votre voyage. Merci de nous indiquer votre destination, votre ville de dÃ©part, vos dates de dÃ©part et de retour, et le nombre de passagers. Un conseiller AMI Voyages prendra ensuite le relais.', fr: 'Nous pouvons vous aider Ã  organiser votre voyage. Veuillez nous indiquer votre destination, la ville de dÃ©part, les dates de dÃ©part et de retour ainsi que le nombre de passagers. Un conseiller d'AMI Voyages vous assistera ensuite.
  { nom: 'horaires_ouverture', prioritÃ©: 80, handoff: faux, tests: [/\bhoraire\s+ouverture\b/i, /\bhoraires?\b.*\bouverture\b/i, /\bquels\s+sont\s+vos\s+horaires\b/i, /\bvous\s+etes\s+ouvert\b/i, /\bvous\s+etes\s+ouvert\s+quand\b/i, /\bcest\s+ouvert\b/i, /\bouvrez\s+quand\b/i, /\bfermez\s+a\s+quelle\s+heure\b/i, /\btravaillez\s+aujourd'hui\b/i, /\bvous\s+etes\s+la\b/i, /\bvous\s+ouvrez\s+aujourd\s+hui\b/i, /\ba\s+quelle\s+heure\s+vous\s+ouvrez\b/i, /\bvous\s+fermez\s+quand\b/i, /\bc\s+ouvert\b/i, /\bouvert\s+demain\b/i, /\bopening\s+hours\b/i, /\bwhat\s+time\s+(?:do\s+you\s+)?open\b/i, /\bwhat\s+time\s+(?:do\s+you\s+)?close\b/i, /\bare\s+you\s+open\b/i], rÃ©ponse: { fr: 'Nos horaires sont les suivants :\nAMI Voyages Paris Gare du Nord, 157 rue Lafayette, 75010 Paris ouvert du lundi au samedi de 10h00 Ã  18h30.\nAMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la RÃ©publique, 93300 Aubervilliers ouvert du mardi au vendredi de 10h00 Ã  18h30.\nVous pouvez aussi nous Ã©crire ici sur WhatsApp.', fr: 'Nos horaires sont les suivants :\nAMI Voyages Paris Gare du Nord, 157 rue Lafayette, 75010 Paris ouvert du lundi au samedi de 10h Ã  18h30.\nAMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la RÃ©publique, 93300 Aubervilliers ouvert du mardi au vendredi de 10h Ã  18h30.\nVous pouvez Ã©galement nous Ã©crire ici sur WhatsApp.' } },
  { name: 'localisation_agences', priority: 75, handoff: false, tests: [/\blocalisation\b.*\bagence\b/i, /\badresse\b.*\bagence\b/i, /\b(?:agence|adresse|ami\s+voyages)\b.*\bparis\b/i, /\b(?:agence|adresse|ami\s+voyages)\b.*\baubervilliers\b/i, /\bvous\s+etes\s+ou\b/i, /\bou\s+se\s+trouve\s+votre\s+agence\b/i, /\bc\s+est\s+ou\s+ami\s+voyages\b/i, /\badresse\s+paris\b/i, /\badresse\s+aubervilliers\b/i, /\bwhere\s+are\s+you\b/i, /\blocation\b/i, /\baddress\b/i], rÃ©ponse: { fr: 'Voici nos agences :\nAMI Voyages Paris Gare du Nord, 157 rue Lafayette, 75010 Paris ouvert du lundi au samedi de 10h00 Ã  18h30.\nAMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la RÃ©publique, 93300 Aubervilliers ouvert du mardi au vendredi de 10h00 Ã  18h30.\nVous pouvez aussi nous Ã©crire ici sur WhatsApp.', fr: 'Voici nos bureaux :\nAMI Voyages Paris Gare du Nord, 157 rue Lafayette, 75010 Paris ouvert du lundi au samedi de 10h Ã  18h30.\nAMI Voyages Aubervilliers Quatre Chemins, 100 avenue de la RÃ©publique, 93300 Aubervilliers ouvert du mardi au vendredi De 10h Ã  18h30.\nVous pouvez Ã©galement nous Ã©crire ici sur WhatsApp.
  { nom: 'destination_couverte', prioritÃ©: 70, transfert: faux, tests: [/\bbangladesh\b/i, /\binde\b/i, /\bSri\s+Lanka\b/i, /\bMali\b/i, /\bS[eÃƒÂ©]n[eÃƒÂ©]gal\b/i, /\bGuin[eÃ©]e\b/i, /\bRDC\b/i], rÃ©ponse: { fr: 'Oui, nous travaillons sur cette destination.\nMerci de nous suggÃ©rer :\nvotre ville de dÃ©part et votre ville de retour,\nvos dates de dÃ©part et de retour,\nle nombre de passagers,\nvotre prÃ©fÃ©rence Ã©ventuelle : compagnie aÃ©rienne, vol direct ou prix le plus bas.\nUn agent vous indique le meilleur prix actuel.', fr: 'Oui, nous Nous travaillons sur cette destination.\nVeuillez nous indiquer :\nvos villes de dÃ©part et de retour,\nvos dates de dÃ©part et de retour,\nle nombre de passagers,\nvos prÃ©fÃ©rences (le cas Ã©chÃ©ant) : compagnie aÃ©rienne, vol direct ou prix le plus bas.\nUn agent vous communiquera le meilleur prix disponible.
  { nom: 'promos', prioritÃ©: 65, transfert: faux, tests: [/\bpromo[s]?\b/i, /\boffre[s]?\s+special/i, /\bFrance\b.*\bLisbonne\b.*\bDhaka\b/i, /\bLisbonne[- ]Dhaka\b/i, /\bspecial\s+offer\b/i, /\bdiscount\b/i], rÃ©ponse: { fr: 'Oui, nous pouvons proposer des tarifs avantageux au dÃ©part de la France avec retour en France, ainsi que sur Lisbonne-Dhaka.\nNous pouvons Ã©galement traiter d'autres destinations.\nLes meilleurs tarifs sont en gÃ©nÃ©ral hors vacances et hors week- end.\nSi vous souhaitez connaÃ®tre les tarifs, merci de nous indiquer: \nvotre destination, \nvotre ville de dÃ©part et votre ville de retour, \nvos dates de dÃ©part et de retour, \nle nombre de passagers, \nvotre prÃ©fÃ©rence Ã©ventuelle: compagnie aÃ©rienne, vol direct ou prix le plus bas.\nUn agent vous indiquera le meilleur prix actuel.', en: 'Yes we can offer advantage rates from France with retour to France, as well as on Lisbon- Dhaka.\nWe can also manage other destinations.\nThe best rates are usually out during holidays and weekends.\nIf you want to know prices please tell us: \nyour destination, \nyour departure and retour city, \nyour departure and retour dates, \nnumber of passengers, \nyour preference if any: airline, vol direct ou prix le plus bas.\nAn agent will tell you the best price available.' } },
{ nom: 'bus', prioritÃ© : 64, handoff : false, tests : [/\bfaites[- ]?vous.*bus\b/i, /\bbus\b/i, /\btrain\b/i, /\bdo\s+you\s+(?:offer|have)\s+bus\b/i, /\bbus\s+or\s+train\b/i], rÃ©ponse : { fr: 'Non, nous proposons uniquement des voyages aÃ©riens.\nNotre agence est spÃ©cialisÃ©e dans les destinations d'Asie du Sud, comme le Bangladesh, l'Inde et le Sri Lanka, ainsi que d'Afrique subsaharienne, comme le Mali, le SÃ©nÃ©gal, la GuinÃ©e ou la RDC.', fr: 'Non, nous proposons uniquement des voyages aÃ©riens.\nNotre agence est spÃ©cialisÃ©e dans les destinations d'Asie du Sud comme le Bangladesh, l'Inde et le Sri Lanka, ainsi que l'Afrique subsaharienne comme comme le Mali, SÃ©nÃ©gal, GuinÃ©e ou RDC.' } },
{
  nom: 'appel_non_repondu', prioritÃ© : 60, handoff : faux, tests : [/\bvous\s+ne\s+repondez\s+pas\b/i, /\bje\s+n'?arrive\s+pas\s+a\s+vous\s+joindre\b/i, /\blignes?\s+sont\s+occupe(?:es)?\b/i, /\bje\s+vous\s+ai\s+appele\b/i, /\bvous\s+m'?avez\s+pas\s+repondu\b/i, /\bappel\s+manque\b/i, /\bpersonne\s+ne\s+repond\b/i, /\bjai\s+appele\b/i, /\bje\s+vous\s+appelle\s+depuis\s+ce\s+matin\b/i, /\bj(?:e)?\s+appelle\s+mais\s+ca\s+repond\s+pas\b/i, /\bsa\s+repond\s+pas\b/i, /\bon\s+me\s+repond\s+pas\b/i, /\bje\s+tombe\s+sur\s+rien\b/i, /\bvous\s+repondez\s+jamais\b/i, /\byou\s+don't\s+answer\b/i, /\bi\s+can't\s+reach\s+you\b/i, /\bmissed\s+call\b/i], rÃ©ponse: {
    fr: 'Nous sommes dÃ©solÃ©s si vous n'avez pas reÃ§u de rÃ©ponse rapide.\nPouvez - vous nous prÃ©ciser votre demande ou nous laisser votre numÃ©ro ? Un conseiller AMI Voyages vous reviendra dÃ¨s que possible.
  {
      nom: 'agent_disponible', prioritÃ© : 58, handoff : false, tests : [/\bagent\s+disponible\b/i, /\bconseiller\s+disponible\b/i, /\best\s+quelqu'un\s+disponible\b/i, /\bagent\s+available\b/i, /\bis\s+someone\s+available\b/i], rÃ©ponse : {
        fr: 'Tous nos agents sont disponibles selon leur planification. Nous faisons de notre mieux pour rÃ©pondre dans les meilleurs dÃ©lais pendant les horaires d'ouverture.\nEn dehors de ces horaires, vous pouvez dÃ©jÃ  nous laisser votre demande ici sur WhatsApp.', en: 'Tous nos agents sont disponibles selon leur planning.Nous faisons de notre mieux pour rÃ©pondre rapidement pendant les heures de bureau.\nEn dehors de ces heures, vous pouvez laisser votre demande ici sur WhatsApp.' } },
        {
          nom: 'delai_reponse', prioritÃ© : 55, handoff : false, tests : [/\bdelai\s+de\s+reponse\b/i, /\bcombien\s+de\s+temps\s+pour\s+repondre\b/i, /\ben\s+combien\s+de\s+temps\b/i, /\bresponse\s+time\b/i, /\bhow\s+long\s+to\s+respond\b/i], rÃ©ponse : {
            fr: 'Nous faisons de notre mieux pour rÃ©pondre dans les meilleurs dÃ©lais pendant les horaires d'ouverture.\nEn dehors de ces horaires, vous pouvez dÃ©jÃ  nous laisser votre demande ici sur WhatsApp.', en: 'Nous faisons de notre mieux pour rÃ©pondre rapidement pendant les heures ouvrables.\nEn dehors de ces horaires, vous pouvez laisser votre demande ici sur WhatsApp.' } },
            { nom: 'duree_minimum', prioritÃ© : 50, transfert : faux, tests : [/\bduree\s+minimum\b/i, /\bminimum\s+de\s+jours\b/i, /\bsejour\s+minimum\b/i, /\bminimum\s+stay\b/i, /\bminimum\s+days\b/i], rÃ©ponse : { fr: 'En Asie, c'est gÃ©nÃ©ralement 5 Ã  7 jours.\nEn Afrique, c'est gÃ©nÃ©ralement 3 jours, selon la compagnie aÃ©rienne.', en: 'En Asie, c'est gÃ©nÃ©ralement 5 Ã  7 jours.\nEn Afrique, c'est gÃ©nÃ©ralement 3 jours, selon la compagnie aÃ©rienne.' } },
            { name: 'au_revoir', priority: 41, handoff: false, tests: [/\bau\s+revoir\b/i, /\ba\s+bientot\b/i, /\bbye\b/i, /\bbonne\s+journÃ©e\b/i, /\bbonne\s+soiree\b/i, /\ba\s+plus\b/i, /\bon\s+se\s+recontacte\b/i, /\bgoodbye\b/i, /\bsee\s+you\b/i, /\bsee\s+you\s+soon\b/i], response: { fr: 'Merci pour votre message. Ã€ bientÃ´t chez AMI Voyages.', en: 'Thank you for your message. See you soon at AMI Voyages.' } },
            {
              nom: 'demande_humain', prioritÃ© : 90, handoff : true, tests : [/\bje\s+veux\s+parler\s+a\s+un\s+agent\b/i, /\bje\s+veux\s+parler\s+a\s+un\s+conseiller\b/i, /\bje\s+veux\s+parler\s+a\s+quelqu['']un\b/i, /\bun\s+agent\b/i, /\bun\s+conseiller\b/i, /\bhumain\b/i, /\bservice\s+client\b/i, /\bappelez[- ]?moi\b/i, /\bpouvez[- ]?vous\s+me\s+rappeler\b/i, /\bi\s+want\s+to\s+speak\s+to\s+(?:an\s+)?agent\b/i, /\bspeak\s+to\s+(?:a\s+)?human\b/i, /\bcustomer\s+service\b/i], rÃ©ponse : {
                fr: 'Bien sÃƒÂ»r. Merci de nous indiquer votre nom, votre numÃ©ro de tÃ©lÃ©phone et l'objet de votre demande.Un conseiller AMI Voyages prendra ensuite le relais.', en: 'Bien sÃ»r.Veuillez indiquer votre nom, votre numÃ©ro de tÃ©lÃ©phone et l'objet de votre demande. Un conseiller AMI Voyages vous assistera ensuite. } },
                {
                  nom: 'remerciement',
                    prioritÃ© : 42,
                      transfert : faux,
                        tests : [
                          /\bmerci\b/i,
                          /\bmerci\s+beaucoup\b/i,
                          /\bmerc[iÃƒÂ®]e?\s+a\s+vous\b/i,
                          /\bok\s+merci\b/i,
                          /\bdaccord\s+merci\b/i,
                          /\bgrand\s+merci\b/i,
                          /\bmercii+\b/i,
                          /\bmrc\s+bcp\b/i,
                          /\bmrc\b/i,
                          /\bmerci\s+(?:vous|vous\s+trÃ¨s\s+beaucoup)\b/i,
                          /\bmerci\b/i,
                          /\bmerci\s+(?:you\s+)?trÃ¨s\s+much\b/i,
                        ],
                          rÃ©ponse : {
                            fr: 'Avec plaisir. Je reste Ã  votre disposition pour votre voyage.', fr: 'Avec plaisir. Je reste Ã  votre service pour votre voyage. }
                  },
                  {
                    nom: 'politesse_ca_va',
                      prioritÃ© : 41,
                        transfert : faux,
                          tests : [
                            /\b(?:ca\s+va|sa\s+va|sava)\b/i,
                            /\b(?:ca|sa)\s+roule\b/i,
                            /\bca\s+baigne\b/i,
                            /\bca\s+regard\b/i,
                            /\bcomment\s+(?:ca\s+va|sa\s+va|sava)\b/i,
                            /\btu\s+va(?:s)?\s+bien\b/i,
                            /\bvous\s+allez\s+bien\b/i,
                            /\bcomment\s+va(?:s)?[- ]?tu\b/i,
                            /\bcomment\s+tu\s+va(?:s)?\b/i,
                            /\bcomment\s+allez[- ]?vous\b/i,
                            /\bcomment\s+vous\s+allez\b/i,
                            /\btu\s+te\s+sens\s+bien\b/i,
                            /\bvous\s+vous\s+sentez\s+bien\b/i,
                            /\bcomment\s+tu\s+te\s+sens\b/i,
                            /\bcomment\s+vous\s+vous\s+sentez\b/i,
                            /\bbien\s+ou\s+bien\b/i,
                            /\bcomment\s+(?:allez\s+)?vous\b/i,
                            /\bcomment\s+Ãªtes\s+vous\s+(?:faire|se sentir)\b/i,
                            /\bQuoi de neuf\b/i
                          ],
                            rÃ©ponse : {
                              fr: 'Oui, Ã§a va trÃ¨s bien, et vous ? Bienvenue chez AMI Voyages.\nNous sommes une agence de voyages spÃ©cialisÃ©e dans les vols en direction de l'Asie du Sud et de l'Afrique subsaharienne.\nEn quoi puis-je vous aider ?\nSi vous souhaitez connaÃ®tre les tarifs, merci de nous indiquer :\nvotre destination,\nvotre ville de dÃ©part et votre ville de retour,\nvos dates de dÃ©part et de retour,\nle nombre de passagers,\nvotre prÃ©fÃ©rence Ã©ventuelle : compagnie aÃ©rienne, vol direct ou prix le plus bas.\nUn agent vous indique le meilleur prix actuel.', en: 'Oui, je vais trÃ¨s bien ! Bienvenue chez AMI Voyages. Nous sommes une agence de voyages spÃ©cialisÃ©e dans les vols vers l'Asie du Sud et l'Afrique subsaharienne. Comment pouvons-nous vous aider ? Si vous souhaitez connaÃ®tre les prix, veuillez nous indiquer : votre destination, vos villes de dÃ©part et de retour, vos dates de dÃ©part et de retour, le nombre de passagers et vos prÃ©fÃ©rences (compagnie aÃ©rienne, vol direct ou prix le plus bas). Un agent vous communiquera le meilleur prix disponible.
                    },
                    {
                      nom: 'salutation', prioritÃ© : 40, transfert : faux, tests : [/\bbonjour\b/i, /\bsalut\b/i, /\bbjr\b/i, /\bhi\b/i, /\bhello\b/i, /\bslt\b/i, /\bgreetings\b/i],
                        rÃ©ponse: {
                          fr: 'Bonjour, bienvenue chez AMI Voyages.\nNous sommes une agence de voyages spÃ©cialisÃ©e dans les vols en direction de l'Asie du Sud et de l'Afrique subsaharienne.\nEn quoi puis-je vous aider ?\nSi vous souhaitez connaÃ®tre les tarifs, merci de nous indiquer :\nvotre destination,\nvotre ville de dÃ©part et votre ville de retour,\nvos dates de dÃ©part et de retour,\nle nombre de passagers,\nvotre prÃ©fÃ©rence Ã©ventuelle : compagnie aÃ©rienne, vol direct ou prix le plus bas.\nUn agent vous indiquea le meilleur prix actuel.', fr: 'Bonjour, bienvenue chez AMI Voyages.\nNous sommes une agence de voyages spÃ©cialisÃ©e dans les vols vers l'Asie du Sud et l'Afrique subsaharienne.\nComment puis-je vous aider ?\nSi vous souhaitez connaÃ®tre les tarifs, dites-nous :\nvotre Destination, ville de dÃ©part et de retour, dates de dÃ©part et de retour, nombre de passagers, vos prÃ©fÃ©rences (le cas Ã©chÃ©ant) : compagnie aÃ©rienne, vol direct ou prix le plus bas. Un agent vous indiquera le meilleur prix disponible.
                      }, {
                        nom: 'salam',
                          prioritÃ© : 40,
                            transfert : faux,
                              tests : [
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
                                rÃ©ponse: {
                                  fr: 'Walaikum assalam, bienvenue chez AMI Voyages.\nNous sommes une agence de voyages spÃ©cialisÃ©e dans les vols en direction de l'Asie du Sud et de l'Afrique subsaharienne.\nEn quoi puis-je vous aider ?\nSi vous souhaitez connaÃ®tre les tarifs, merci de nous indiquer :\nvotre destination,\nvotre ville de dÃ©part et votre ville de retour,\nvos dates de dÃ©part et de retour,\nle nombre de passagers,\nvotre prÃ©fÃ©rence Ã©ventuelle : compagnie aÃ©rienne, vol direct ou prix le plus bas.\nUn agent vous indique le meilleur prix actuel.', en: 'Walaikum assalam, bienvenue chez AMI Voyages.\nNous sommes une agence de voyages spÃ©cialisÃ©e dans les vols vers l'Asie du Sud et l'Afrique subsaharienne.\nComment puis-je vous aider ?\nSi vous souhaitez connaÃ®tre les tarifs, n'hÃ©sitez pas dire Indiquez - nous : votre destination, vos villes de dÃ©part et de retour, vos dates de dÃ©part et de retour, le nombre de passagers et vos prÃ©fÃ©rences(le cas Ã©chÃ©ant : compagnie aÃ©rienne, vol direct ou prix le plus bas).Un agent vous communiquera le meilleur prix disponible.
  },

].sort((a, b) => b.prioritÃ© - a.prioritÃ©);

fonction normaliserTexte(texte) {
  renvoie String(texte || '')
                            .toLowerCase()
                            .normaliser('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .replace(/[^\w\s]/g, ' ')
                            .replace(/\s+/g, ' ')
                            .garniture();
                        }

fonction parseLeadingGreeting(texte = '', lang = 'fr') {
                          const normalisÃ© = normalizeText(texte);
                          const modÃ¨les = lang === 'en'
                            ? [{ prefix: 'Bonjour', regex: /^(?:hello|hi|hey)\b[\s,]*(.*)$/ }]
                            : [{ prefix: 'Bonjour', regex: /^(?:bonjour|salut|bjr|slt)\b[\s,]*(.*)$/ }, { prefix: 'Walaikum assalam', regex: /^(?:slm|salam(?:\s+(?:alaik|aleyk|alayk)(?:oum|um))?|salam(?:a|u)?(?:laik|leyk|layk)(?:oum|um)|as[-\s]+salam(?:u)?\s+(?:alaik|aleyk|alayk)(?:oum|um)|assalam(?:u)?\s+(?:alaik|aleyk|alayk)(?:oum|um))\b[\s,]*(.*)$/i }];

                          pour(const { prÃ©fixe, expression rÃ©guliÃ¨re } de motifs) {
                            const match = normalized.match(regex);
                          si(correspondance) {
                            const rest = String(match[1] || '').trim();
                            return { greeting: prefix, rest, isOnlyGreeting: rest.length === 0 };
                          }
                        }
                        return { greeting: null, rest: String(text || '').trim(), isOnlyGreeting: false };
                      }

fonction prefixResponse(salutation, rÃ©ponse) {
                        si(!salutation) retourner String(rÃ©ponse || '');
                        const trimmed = String(response || '').trim();
                        si(!trimmed) retourner trimmed;
                        si(trimmed.toLowerCase().startsWith(greeting.toLowerCase())) retourner trimmed;
                        renvoie`${greeting}, ${trimmed}`;
                      }

fonction extraireDestinationVoyage(texte = '') {
                        const normalisÃ© = normalizeText(texte);
                        const motifs = [
                          /\b(?:je\s+veux\s+(?:aller|voyager|partir)\s+(?:en|a|au|aux|vers|pour)\s+([az][az\s]{1,60}))/,
                          /\b(?:je\s+cherche\s+(?:un\s+vol\s+)?(?:pour|en|a|au|aux|vers)\s+([az][az\s]{1,60}))/,
                          /\b(?:billet\s+pour\s+([az][az\s]{1,60}))/,
                          /\b(?:partir\s+(?:pour|en|a|au|aux|vers)\s+([az][az\s]{1,60}))/,
                          /\b(?:voyager\s+(?:pour|en|a|au|aux|vers)\s+([az][az\s]{1,60}))/,
                          /\b(?:i\s+(?:want\s+)?(?:to\s+)?(?:go|travel)\s+to\s+([az][az\s]{1,60}))/,
                          /\b(?:voyage\s+to\s+([az][az\s]{1,60}))/,
                          /\b(?:ticket\s+to\s+([az][az\s]{1,60}))/,
                        ];
                        pour(const motif de motifs) {
                          const match = normalized.match(pattern);
                        si(correspondance && correspondance[1]) {
      retourner match[1].trim();
                        }
                      }
  retour '';
                    }

fonction detectIntent(message = '') {
                      const Message normalisÃ© = normaliserTexte(message);
                      pour(const intention de INTENTS) {
                        essayer {
                          si (intent.tests.some((regex) => regex.test(normalizedMessage))) {
        intention de retour;
                      }
                    } attraper(e) {
                      // ignorer les erreurs d'expression rÃ©guliÃ¨re
                    }
                  }
  renvoyer null;
                }

fonction asynchrone gÃ©nÃ©rerRÃ©ponseVoyage(texteDuMessage, expÃ©diteur) {
                  const safeText = String(messageText || '').trim();
                  si(!safeText) retourner t(detectLanguage(safeText), 'message_vide');

                  const lang = detectLanguage(safeText);
                  const { greeting, rest, isOnlyGreeting } = parseLeadingGreeting(safeText, lang);
                  const cleanText = rest || safeText;

                  si(isOnlySareting) {
                    const intent = detectIntent(cleanText);
                    const responseText = intent ? (typeof intent.response === 'object' ? intent.response[lang] : intent.response) : t(lang, 'empty_message');
    renvoyer prefixResponse(salutation, texte_rÃ©ponse);
                  }

                  si(expÃ©diteur) {
                    const session = getSession(expÃ©diteur);
                    si(session.awaitingContact && looksLikeContactInfo(cleanText)) {
                      effacerSession(expÃ©diteur);
      renvoie t(lang, 'handoff_ack');
                    }
                  }

                  const intent = detectIntent(cleanText);
                  si(intention) {
                    if (intent.name === 'projet_voyage') {
                      const destination = extraireDestinationVoyage(cleanText);
                      si(destination) {
                        const msg = lang === 'en'
          Â« Super, nous pouvons vous aider Ã  organiser votre voyage Ã  ${ destination }. Veuillez nous indiquer votre ville de dÃ©part, vos dates de dÃ©part et de retour, ainsi que le nombre de passagers.Un conseiller AMI Voyages vous assistera ensuite. Â»
          : `Super, nous pouvons vous aider Ã  organiser votre voyage vers ${destination}. Merci de nous indiquer votre ville de dÃ©part, vos dates de dÃ©part et de retour, et le nombre de passagers. Un conseiller AMI Voyages prendra ensuite le relais.
        renvoyer prefixResponse(salutation, msg);
      }
    }
    si (intent.handoff && expÃ©diteur) {
      enregistrerSession(expÃ©diteur, { en attente de contact : vrai, intention : intent.nom, horodatage : Date.maintenant(), langue : lang });
    }
    const responseText = typeof intent.response === 'object' ? intent.response[lang] : intent.response;
    renvoyer prefixResponse(salutation, texte_rÃ©ponse);
  }

  renvoie prefixResponse(salutation, t(lang, 'message_inconnu'));
}

fonction asynchrone handleTextMessage(texte, expÃ©diteur) {
  retourner await generateTravelReply(texte, expÃ©diteur);
}

fonction asynchrone transcrireAudio(chemin_fichier) {
  essayer {
    return '[transcription indisponible]';
  } attraper (e) {
    retour '';
  }
}

fonction asynchrone downloadFile(url, destPath) {
  const writer = fs.createWriteStream(destPath);
  const response = await axios.get(url, { responseType: 'stream', headers: { Authorization: `Bearer ${ process.env.WHATSAPP_TOKEN } ` } });
  rÃ©ponse.donnÃ©es.pipe(Ã©crivain);
  retourner une nouvelle promesse((rÃ©solution, rejet) => {
    Ã©crivain.on('finir', rÃ©soudre);
    Ã©crivain.on('erreur', rejeter);
  });
}

fonction asynchrone handleAudioMessage(message, expÃ©diteur) {
  essayer {
    const media = message?.audio || message?.voice || null;
    const mediaId = media?.id || message?.id || nul;
    si (!mediaId) retourner t('fr', 'unsupported_media');

    const mediaUrlResp = await axios.get(`https://graph.facebook.com/v17.0/${mediaId}`, { params: { access_token: process.env.WHATSAPP_TOKEN } });
                        const mediaUrl = mediaUrlResp.data?.url;
                        if (!mediaUrl) return t('fr', 'unsupported_media');

                        const tmpPath = `./tmp_${Date.now()}.ogg`;
    attendre downloadFile(mediaUrl, tmpPath);
                        const transcription = await transcribeAudio(tmpPath);
                        try { await fs.promises.unlink(tmpPath); } catch (e) { }

                        const lang = detectLanguage(transcription);
                        si(!transcription) retourner t(lang, 'no_transcription');
    retourner attendre generateTravelReply(transcription, expÃ©diteur);
                      } attraper(e) {
                        console.warn('[AUDIO] erreur:', e.message || e);
    renvoyer t('fr', 'erreur_audio');
                      }
                    }

fonction assainirRÃ©ponse(texte) {
                      return String(texte || '').replace(/\s+/g, ' ').trim();
                    }

fonction asynchrone sendWhatsAppText(to, body) {
                      const url = `https://graph.facebook.com/v17.0/${process.env.PHONE_NUMBER_ID}/messages`;
                      const texte = assainirRÃ©ponse(corps);
  essayer {
                        const payload = {
                          produit_de_messagerie: 'whatsapp',
                          Ã ,
                          type: 'texte',
                          texte: { preview_url: false, corps: texte }
                        };
                        const rÃ©ponse = await axios.post(url, payload, {
                          en- tÃªtes : {
                          Autorisation: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                          'Content-Type': 'application/json'
                        }
    });
                      console.log('[WHATSAPP] Message envoyÃ©, id:', rÃ©ponse.data.messages?.[0]?.id || 'aucun id');
                    } attraper(erreur) {
                      console.error('[WHATSAPP] Erreur d'envoi du message : ', error.response?.data || error.message || error);
    lever une erreur ;
                    }
                  }

                  app.get('/', (req, res) => {
                    res.send('Le chatbot AMI Voyages est en cours d'exÃ©cution');
});

                  app.get('/webhook', (req, res) => {
                    const mode = req.query['hub.mode'];
                    const token = req.query['hub.verify_token'];
                    const challenge = req.query['hub.challenge'];

                    si(mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    retourner res.status(200).send(String(challenge));
                    }
                    return res.status(403).send('Ã‰chec de la vÃ©rification du webhook');
                  });

                  app.post('/webhook', async (req, res) => {
  essayer {
                      const corps = req.corps;
                      si(
                        body.object !== 'whatsapp_business_account' ||
                        !corps.entrÃ©e ||
                        !corps.entrÃ©e[0] ||
                        !body.entry[0].changes ||
                        !body.entry[0].changes[0] ||
                        !body.entry[0].changes[0].value
                      ) {
                        return res.status(200).send('Ignorer l'Ã©vÃ©nement non - WhatsApp');
    }

    valeur constante = corps.entrÃ©e[0].changements[0].valeur;
                      const messages = valeur.messages || [];
                      si(!messages.length) {
                        return res.status(200).send('Aucun message');
                      }

                      const message = messages[0];
                      const messageId = message?.id || message?.message?.id || message?.message_id || null;
                      si(messageId && isMessageProcessed(messageId)) {
                        console.log('[WEBHOOK] message en double ignorÃ©', messageId);
                        return res.status(200).send('Message en double ignorÃ©');
                      }
                      // Marquer tÃ´t pour Ã©viter les conditions de course (sera nettoyÃ© Ã  l'intervalle)
                      marquerMessageProcessed(messageId);
                      const expÃ©diteur = message.from;
                      let replyText = '';

                      si(message.type === 'text' && message.text?.body) {
                        replyText = await handleTextMessage(message.text.body, sender);
                      } else if (['audio', 'voice'].includes(message.type)) {
                        replyText = await handleAudioMessage(message, sender);
                      } else if (message.type === 'sticker' || message.type === 'image' || message.type === 'video' || message.type === 'document' || message.type === 'location' || message.type === 'contacts') {
                        replyText = t('fr', 'mÃ©dia_non_pris en charge');
                      } autre {
                        replyText = t('fr', 'message_inconnu');
                      }

    attendre envoyerWhatsAppText(expÃ©diteur, texte de rÃ©ponse);
                      res.status(200).send('OK');
                    } attraper(erreur) {
                      console.error('[WEBHOOK] Erreur de traitement', erreur);
                      res.status(500).send('Erreur serveur');
                    }
                  });

                  app.listen(PORT, () => {
                    console.log(`Serveur en cours d'exÃ©cution sur le port ${PORT}`);
                  });