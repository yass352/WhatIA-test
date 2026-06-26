'use strict';

// =====================================================================
// TEXTES SYSTEME TRILINGUES
// =====================================================================
const TEXTS = {
  fr: {
    unsupported_media: "Désolé, je ne peux pas traiter ce type de fichier. Décrivez votre demande par écrit.",
    handoff_ack: "✅ Merci, ces informations ont bien été notées. Un conseiller AMI Voyages vous recontactera très prochainement.",
    no_transcription: "Je n'ai pas réussi à comprendre votre message vocal. Pourriez-vous le réécrire en texte ?",
    audio_error: "Une erreur est survenue avec votre message vocal. Un conseiller peut vous aider si besoin.",
    empty_message: "Je suis à votre écoute. Pourriez-vous préciser votre demande ?",
    unknown_message: "Je n'ai pas bien compris. Tapez *menu* pour voir toutes nos options.",
    awaiting_human: "👨‍💼 Votre demande a déjà été transmise à un conseiller. Merci de patienter ou tapez *menu* pour recommencer.",
    human_info_received: "✅ Information reçue. Un conseiller AMI Voyages vous recontactera très prochainement.",
    session_expired: "Bonjour ! Votre session a expiré. Tapez *menu* pour recommencer."
  },
  en: {
    unsupported_media: "Sorry, I can't process this type of file. Please describe your request in writing.",
    handoff_ack: "✅ Thank you, this information has been noted. An AMI Voyages advisor will contact you very soon.",
    no_transcription: "I couldn't understand your voice message. Could you write it as text instead?",
    audio_error: "Something went wrong with your voice message. An advisor can help if needed.",
    empty_message: "I'm listening. Could you tell me more about what you need?",
    unknown_message: "I didn't quite understand. Type *menu* to see all our options.",
    awaiting_human: "👨‍💼 Your request has already been forwarded to an advisor. Please wait, or type *menu* to restart.",
    human_info_received: "✅ Information received. An AMI Voyages advisor will contact you very soon.",
    session_expired: "Hello! Your session has expired. Type *menu* to restart."
  },
  bn: {
    unsupported_media: "দুঃখিত, আমি এই ফাইল প্রক্রিয়া করতে পারছি না। লিখে জানান।",
    handoff_ack: "✅ ধন্যবাদ, তথ্য নোট করা হয়েছে। AMI Voyages-এর একজন উপদেষ্টা শীঘ্রই যোগাযোগ করবেন।",
    no_transcription: "আপনার ভয়েস বার্তা বুঝতে পারিনি। টেক্সটে লিখুন।",
    audio_error: "ভয়েস বার্তায় সমস্যা হয়েছে। প্রয়োজনে একজন উপদেষ্টা সাহায্য করবেন।",
    empty_message: "আমি শুনছি। বিস্তারিত বলুন।",
    unknown_message: "বুঝতে পারিনি। সব বিকল্প দেখতে *menu* লিখুন।",
    awaiting_human: "👨‍💼 আপনার অনুরোধ উপদেষ্টার কাছে পাঠানো হয়েছে। অপেক্ষা করুন বা *menu* লিখুন।",
    human_info_received: "✅ তথ্য পাওয়া গেছে। AMI Voyages-এর একজন উপদেষ্টা শীঘ্রই যোগাযোগ করবেন।",
    session_expired: "হ্যালো! সেশন মেয়াদ শেষ। পুনরায় শুরু করতে *menu* লিখুন।"
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
// SELECTEUR DE LANGUE (boutons interactifs)
// =====================================================================
const LANG_PICKER = {
  body: {
    fr: "🌍 Bienvenue chez *AMI Voyages* !\n\nNous sommes spécialisés dans les vols vers l'Asie du Sud et l'Afrique subsaharienne.\n\nChoisissez votre langue :",
    en: "🌍 Welcome to *AMI Voyages*!\n\nWe specialize in flights to South Asia and sub-Saharan Africa.\n\nPlease choose your language:",
    bn: "🌍 *AMI Voyages*-এ আপনাকে স্বাগতম!\n\nআমরা দক্ষিণ এশিয়া ও আফ্রিকায় ফ্লাইটে বিশেষজ্ঞ।\n\nআপনার ভাষা বেছে নিন:"
  },
  buttons: [
    { id: 'lang_fr', title: 'Français' },
    { id: 'lang_en', title: 'English' },
    { id: 'lang_bn', title: 'বাংলা' }
  ],
  textFallback: {
    fr: "🌍 Bienvenue chez AMI Voyages !\n\nChoisissez votre langue / Choose your language / আপনার ভাষা বেছে নিন :\n\n1️⃣  Français\n2️⃣  English\n3️⃣  বাংলা\n\nRépondez avec 1, 2 ou 3",
    en: "🌍 Bienvenue chez AMI Voyages !\n\nChoisissez votre langue / Choose your language / আপনার ভাষা বেছে নিন :\n\n1️⃣  Français\n2️⃣  English\n3️⃣  বাংলা\n\nRépondez avec 1, 2 ou 3",
    bn: "🌍 Bienvenue chez AMI Voyages !\n\nChoisissez votre langue / Choose your language / আপনার ভাষা বেছে নিন :\n\n1️⃣  Français\n2️⃣  English\n3️⃣  বাংলা\n\nRépondez avec 1, 2 ou 3"
  }
};

// =====================================================================
// MENU PRINCIPAL (liste interactive)
// =====================================================================
const MAIN_MENU = {
  header: 'AMI Voyages',
  buttonLabel: { fr: 'Choisir', en: 'Choose', bn: 'বেছে নিন' },
  body: {
    fr: "Comment puis-je vous aider aujourd'hui ?",
    en: "How can I help you today?",
    bn: "আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?"
  },
  rows: {
    fr: [
      { id: 'flow_book_ticket',    title: 'Réserver un billet',    description: 'Réservation d\'un nouveau billet' },
      { id: 'flow_price',          title: 'Prix & disponibilité',  description: 'Tarifs et places disponibles' },
      { id: 'flow_modify_cancel',  title: 'Modifier ou annuler',   description: 'Modifier, changer, annuler' },
      { id: 'flow_check_booking',  title: 'Vérifier un dossier',   description: 'Statut de votre réservation' },
      { id: 'flow_visa_docs',      title: 'Visa & documents',      description: 'Visa, passeport, formalités' },
      { id: 'flow_payment',        title: 'Paiement',              description: 'Modes et liens de paiement' },
      { id: 'direct_hours',        title: 'Horaires & adresse',    description: 'Nos agences et horaires' },
      { id: 'flow_agent',          title: 'Parler à un agent',     description: 'Contacter un conseiller' }
    ],
    en: [
      { id: 'flow_book_ticket',    title: 'Book a ticket',         description: 'Reserve a new ticket' },
      { id: 'flow_price',          title: 'Price & availability',  description: 'Fares and available seats' },
      { id: 'flow_modify_cancel',  title: 'Modify or cancel',      description: 'Change, modify, cancel' },
      { id: 'flow_check_booking',  title: 'Check my booking',      description: 'Status of your reservation' },
      { id: 'flow_visa_docs',      title: 'Visa & documents',      description: 'Visa, passport, formalities' },
      { id: 'flow_payment',        title: 'Payment',               description: 'Payment methods and links' },
      { id: 'direct_hours',        title: 'Hours & address',       description: 'Our offices and hours' },
      { id: 'flow_agent',          title: 'Talk to an agent',      description: 'Contact an advisor' }
    ],
    bn: [
      { id: 'flow_book_ticket',    title: 'টিকেট বুক করুন',       description: 'নতুন টিকেট বুক করুন' },
      { id: 'flow_price',          title: 'দাম ও প্রাপ্যতা',       description: 'ভাড়া ও আসন' },
      { id: 'flow_modify_cancel',  title: 'পরিবর্তন / বাতিল',     description: 'টিকেট পরিবর্তন বা বাতিল' },
      { id: 'flow_check_booking',  title: 'বুকিং চেক করুন',        description: 'বুকিংয়ের অবস্থা' },
      { id: 'flow_visa_docs',      title: 'ভিসা ও কাগজপত্র',      description: 'ভিসা, পাসপোর্ট, কাগজপত্র' },
      { id: 'flow_payment',        title: 'পেমেন্ট',               description: 'পেমেন্টের পদ্ধতি' },
      { id: 'direct_hours',        title: 'সময় ও ঠিকানা',          description: 'অফিসের সময় ও ঠিকানা' },
      { id: 'flow_agent',          title: 'এজেন্টের সাথে কথা',     description: 'উপদেষ্টার সাথে কথা বলুন' }
    ]
  },
  textFallback: {
    fr: "🏢 *AMI Voyages — Menu principal*\n\n1️⃣  Réserver un billet\n2️⃣  Prix & disponibilité\n3️⃣  Modifier ou annuler\n4️⃣  Vérifier un dossier\n5️⃣  Visa & documents\n6️⃣  Paiement\n7️⃣  Horaires & adresse\n8️⃣  Parler à un agent\n\nTapez le numéro de votre choix.",
    en: "🏢 *AMI Voyages — Main Menu*\n\n1️⃣  Book a ticket\n2️⃣  Price & availability\n3️⃣  Modify or cancel\n4️⃣  Check my booking\n5️⃣  Visa & documents\n6️⃣  Payment\n7️⃣  Hours & address\n8️⃣  Talk to an agent\n\nType the number of your choice.",
    bn: "🏢 *AMI Voyages — মেনু*\n\n1️⃣  টিকেট বুক করুন\n2️⃣  দাম ও প্রাপ্যতা\n3️⃣  পরিবর্তন / বাতিল\n4️⃣  বুকিং চেক করুন\n5️⃣  ভিসা ও কাগজপত্র\n6️⃣  পেমেন্ট\n7️⃣  সময় ও ঠিকানা\n8️⃣  এজেন্টের সাথে কথা\n\nনম্বর লিখুন।"
  }
};

// =====================================================================
// SOUS-MENUS DES FLUX
// =====================================================================
const SUBMENUS = {
  modify_cancel: {
    body: { fr: "Que souhaitez-vous faire ?", en: "What would you like to do?", bn: "আপনি কী করতে চান?" },
    rows: {
      fr: [
        { id: 'sub_modify',           title: 'Modifier un billet',      description: 'Changer les détails' },
        { id: 'sub_change_date',      title: 'Changer la date',         description: 'Modifier la date du vol' },
        { id: 'sub_cancel',           title: 'Annuler un billet',       description: 'Annuler la réservation' },
        { id: 'sub_flight_cancelled', title: 'Mon vol est annulé',      description: 'Vol annulé ou retardé' }
      ],
      en: [
        { id: 'sub_modify',           title: 'Modify a ticket',         description: 'Change ticket details' },
        { id: 'sub_change_date',      title: 'Change the date',         description: 'Modify flight date' },
        { id: 'sub_cancel',           title: 'Cancel a ticket',         description: 'Cancel the booking' },
        { id: 'sub_flight_cancelled', title: 'My flight is cancelled',  description: 'Flight cancelled or delayed' }
      ],
      bn: [
        { id: 'sub_modify',           title: 'টিকেট পরিবর্তন',          description: 'বিস্তারিত পরিবর্তন' },
        { id: 'sub_change_date',      title: 'তারিখ পরিবর্তন',          description: 'ফ্লাইটের তারিখ পরিবর্তন' },
        { id: 'sub_cancel',           title: 'টিকেট বাতিল',             description: 'বুকিং বাতিল করুন' },
        { id: 'sub_flight_cancelled', title: 'আমার ফ্লাইট বাতিল',      description: 'ফ্লাইট বাতিল বা দেরি' }
      ]
    },
    textFallback: {
      fr: "Que souhaitez-vous faire ?\n\n1️⃣  Modifier un billet\n2️⃣  Changer la date\n3️⃣  Annuler un billet\n4️⃣  Mon vol est annulé/retardé\n\nTapez 1, 2, 3 ou 4.",
      en: "What would you like to do?\n\n1️⃣  Modify a ticket\n2️⃣  Change the date\n3️⃣  Cancel a ticket\n4️⃣  My flight is cancelled/delayed\n\nType 1, 2, 3 or 4.",
      bn: "আপনি কী করতে চান?\n\n1️⃣  টিকেট পরিবর্তন\n2️⃣  তারিখ পরিবর্তন\n3️⃣  টিকেট বাতিল\n4️⃣  আমার ফ্লাইট বাতিল\n\n১, ২, ৩ বা ৪ লিখুন।"
    }
  },
  visa_docs: {
    body: { fr: "Quel est votre besoin ?", en: "What do you need?", bn: "আপনার কী দরকার?" },
    rows: {
      fr: [
        { id: 'sub_visa',             title: 'Visa',                    description: 'Demande de visa' },
        { id: 'sub_passport',         title: 'Passeport',               description: 'Validité passeport' },
        { id: 'sub_docs',             title: 'Documents de voyage',     description: 'Papiers requis' },
        { id: 'sub_pregnancy',        title: 'Voyage enceinte',         description: 'Femme enceinte' },
        { id: 'sub_baby',             title: 'Bébé / Enfant',           description: 'Tarif et bagages bébé' }
      ],
      en: [
        { id: 'sub_visa',             title: 'Visa',                    description: 'Visa application' },
        { id: 'sub_passport',         title: 'Passport',                description: 'Passport validity' },
        { id: 'sub_docs',             title: 'Travel documents',        description: 'Required documents' },
        { id: 'sub_pregnancy',        title: 'Travelling pregnant',     description: 'Pregnant passenger' },
        { id: 'sub_baby',             title: 'Baby / Child',            description: 'Baby fares and luggage' }
      ],
      bn: [
        { id: 'sub_visa',             title: 'ভিসা',                    description: 'ভিসার আবেদন' },
        { id: 'sub_passport',         title: 'পাসপোর্ট',               description: 'পাসপোর্টের মেয়াদ' },
        { id: 'sub_docs',             title: 'ভ্রমণ কাগজপত্র',          description: 'প্রয়োজনীয় কাগজপত্র' },
        { id: 'sub_pregnancy',        title: 'গর্ভবতী ভ্রমণ',           description: 'গর্ভবতী যাত্রী' },
        { id: 'sub_baby',             title: 'শিশু / বাচ্চা',           description: 'শিশুর ভাড়া ও ব্যাগ' }
      ]
    },
    textFallback: {
      fr: "Quel est votre besoin ?\n\n1️⃣  Visa\n2️⃣  Passeport\n3️⃣  Documents de voyage\n4️⃣  Voyage enceinte\n5️⃣  Bébé / Enfant\n\nTapez 1 à 5.",
      en: "What do you need?\n\n1️⃣  Visa\n2️⃣  Passport\n3️⃣  Travel documents\n4️⃣  Travelling pregnant\n5️⃣  Baby / Child\n\nType 1 to 5.",
      bn: "আপনার কী দরকার?\n\n1️⃣  ভিসা\n2️⃣  পাসপোর্ট\n3️⃣  ভ্রমণ কাগজপত্র\n4️⃣  গর্ভবতী ভ্রমণ\n5️⃣  শিশু / বাচ্চা\n\n১ থেকে ৫ লিখুন।"
    }
  },
  payment: {
    body: { fr: "Quel est votre besoin ?", en: "What do you need?", bn: "আপনার কী দরকার?" },
    rows: {
      fr: [
        { id: 'sub_payment_methods',  title: 'Moyens de paiement',      description: 'Comment payer' },
        { id: 'sub_online_payment',   title: 'Paiement en ligne',        description: 'Payer en ligne' },
        { id: 'sub_payment_link',     title: 'Lien de paiement',         description: 'Recevoir un lien' },
        { id: 'sub_remote_payment',   title: 'Paiement à distance',      description: 'Payer par carte' }
      ],
      en: [
        { id: 'sub_payment_methods',  title: 'Payment methods',          description: 'How to pay' },
        { id: 'sub_online_payment',   title: 'Online payment',           description: 'Pay online' },
        { id: 'sub_payment_link',     title: 'Payment link',             description: 'Receive a link' },
        { id: 'sub_remote_payment',   title: 'Remote payment',           description: 'Pay by card' }
      ],
      bn: [
        { id: 'sub_payment_methods',  title: 'পেমেন্টের পদ্ধতি',          description: 'কিভাবে পেমেন্ট করবেন' },
        { id: 'sub_online_payment',   title: 'অনলাইন পেমেন্ট',            description: 'অনলাইনে পেমেন্ট' },
        { id: 'sub_payment_link',     title: 'পেমেন্ট লিংক',              description: 'লিংক পাওয়া' },
        { id: 'sub_remote_payment',   title: 'দূরবর্তী পেমেন্ট',          description: 'কার্ডে পেমেন্ট' }
      ]
    },
    textFallback: {
      fr: "Quel est votre besoin ?\n\n1️⃣  Moyens de paiement\n2️⃣  Paiement en ligne\n3️⃣  Lien de paiement\n4️⃣  Paiement à distance\n\nTapez 1 à 4.",
      en: "What do you need?\n\n1️⃣  Payment methods\n2️⃣  Online payment\n3️⃣  Payment link\n4️⃣  Remote payment\n\nType 1 to 4.",
      bn: "আপনার কী দরকার?\n\n1️⃣  পেমেন্টের পদ্ধতি\n2️⃣  অনলাইন পেমেন্ট\n3️⃣  পেমেন্ট লিংক\n4️⃣  দূরবর্তী পেমেন্ট\n\n১ থেকে ৪ লিখুন।"
    }
  }
};

// Boutons de préférence vol (max 3 boutons)
const PREFERENCE_BUTTONS = {
  body: {
    fr: "Avez-vous une préférence ?",
    en: "Do you have a preference?",
    bn: "আপনার কোনো পছন্দ আছে?"
  },
  buttons: {
    fr: [
      { id: 'pref_cheapest', title: 'Prix le plus bas' },
      { id: 'pref_direct',   title: 'Vol direct' },
      { id: 'pref_none',     title: 'Pas de préférence' }
    ],
    en: [
      { id: 'pref_cheapest', title: 'Lowest price' },
      { id: 'pref_direct',   title: 'Direct flight' },
      { id: 'pref_none',     title: 'No preference' }
    ],
    bn: [
      { id: 'pref_cheapest', title: 'সর্বনিম্ন মূল্য' },
      { id: 'pref_direct',   title: 'সরাসরি ফ্লাইট' },
      { id: 'pref_none',     title: 'কোনো পছন্দ নেই' }
    ]
  },
  textFallback: {
    fr: "Avez-vous une préférence ?\n\n1️⃣  Prix le plus bas\n2️⃣  Vol direct\n3️⃣  Pas de préférence\n\nTapez 1, 2 ou 3.",
    en: "Do you have a preference?\n\n1️⃣  Lowest price\n2️⃣  Direct flight\n3️⃣  No preference\n\nType 1, 2 or 3.",
    bn: "আপনার কোনো পছন্দ আছে?\n\n1️⃣  সর্বনিম্ন মূল্য\n2️⃣  সরাসরি ফ্লাইট\n3️⃣  কোনো পছন্দ নেই\n\n১, ২ বা ৩ লিখুন।"
  }
};

// =====================================================================
// PROMPTS DES ETAPES DE FLUX
// =====================================================================
const FLOW_PROMPTS = {
  destination: {
    fr: "📍 Quelle est votre destination ?",
    en: "📍 What is your destination?",
    bn: "📍 আপনার গন্তব্য কী?"
  },
  depart_city: {
    fr: "🛫 Depuis quelle ville partez-vous ?",
    en: "🛫 Which city are you departing from?",
    bn: "🛫 আপনি কোন শহর থেকে যাত্রা করবেন?"
  },
  return_city: {
    fr: "🛬 Quelle est votre ville de retour ?",
    en: "🛬 What is your return city?",
    bn: "🛬 আপনার ফেরার শহর কোনটি?"
  },
  depart_date: {
    fr: "📅 Quelle est votre date de départ ? (ex: 15/08/2025)",
    en: "📅 What is your departure date? (e.g. 15/08/2025)",
    bn: "📅 আপনার যাত্রার তারিখ কী? (যেমন: ১৫/০৮/২০২৫)"
  },
  return_date: {
    fr: "📅 Quelle est votre date de retour ? (ex: 30/08/2025)",
    en: "📅 What is your return date? (e.g. 30/08/2025)",
    bn: "📅 আপনার ফেরার তারিখ কী? (যেমন: ৩০/০৮/২০২৫)"
  },
  passengers: {
    fr: "👥 Combien de passagers ? (ex: 2 adultes, 1 enfant, 1 bébé)",
    en: "👥 How many passengers? (e.g. 2 adults, 1 child, 1 baby)",
    bn: "👥 কতজন যাত্রী? (যেমন: ২ জন বড়, ১ জন শিশু)"
  },
  reference: {
    fr: "🔖 Quelle est votre référence de dossier ou numéro de billet ?",
    en: "🔖 What is your booking reference or ticket number?",
    bn: "🔖 আপনার বুকিং রেফারেন্স বা টিকেট নম্বর কী?"
  },
  passenger_name: {
    fr: "👤 Quel est le nom du passager ?",
    en: "👤 What is the passenger's name?",
    bn: "👤 যাত্রীর নাম কী?"
  },
  phone: {
    fr: "📞 Quel est votre numéro de téléphone ?",
    en: "📞 What is your phone number?",
    bn: "📞 আপনার ফোন নম্বর কী?"
  },
  exact_request: {
    fr: "✏️ Décrivez brièvement votre demande.",
    en: "✏️ Briefly describe your request.",
    bn: "✏️ আপনার অনুরোধটি সংক্ষেপে বর্ণনা করুন।"
  },
  nationality: {
    fr: "🌍 Quelle est votre nationalité ?",
    en: "🌍 What is your nationality?",
    bn: "🌍 আপনার জাতীয়তা কী?"
  },
  expiry_date: {
    fr: "📆 Quelle est la date d'expiration de votre passeport ? (ex: 01/2027)",
    en: "📆 What is your passport expiry date? (e.g. 01/2027)",
    bn: "📆 আপনার পাসপোর্টের মেয়াদ শেষের তারিখ কী? (যেমন: ০১/২০২৭)"
  },
  name: {
    fr: "👤 Votre prénom et nom complet ?",
    en: "👤 Your full first and last name?",
    bn: "👤 আপনার পুরো নাম কী?"
  },
  subject: {
    fr: "💬 Quel est l'objet de votre demande ?",
    en: "💬 What is the subject of your request?",
    bn: "💬 আপনার অনুরোধের বিষয় কী?"
  }
};

// =====================================================================
// INTROS DE FLUX
// =====================================================================
const FLOW_INTROS = {
  book_ticket: {
    fr: "✈️ Parfait ! Commençons votre réservation. Je vais vous poser quelques questions.",
    en: "✈️ Great! Let's start your booking. I'll ask you a few questions.",
    bn: "✈️ চমৎকার! আপনার বুকিং শুরু করা যাক। আমি কয়েকটি প্রশ্ন করব।"
  },
  price: {
    fr: "💰 Parfait ! Cherchons le meilleur tarif pour vous.",
    en: "💰 Great! Let's find the best fare for you.",
    bn: "💰 চমৎকার! আপনার জন্য সেরা ভাড়া খুঁজে বের করা যাক।"
  },
  modify_cancel: {
    fr: "📋 Je vais vous aider avec votre demande.",
    en: "📋 I'll help you with your request.",
    bn: "📋 আমি আপনার অনুরোধে সাহায্য করব।"
  },
  check_booking: {
    fr: "🔍 Je vais vérifier votre dossier. J'ai besoin de quelques informations.",
    en: "🔍 I'll check your booking. I need a few details.",
    bn: "🔍 আমি আপনার বুকিং যাচাই করব। কয়েকটি তথ্য দরকার।"
  },
  visa_docs: {
    fr: "📄 Je vais vous orienter sur les formalités.",
    en: "📄 I'll guide you on the required formalities.",
    bn: "📄 আমি আপনাকে আনুষ্ঠানিকতা সম্পর্কে গাইড করব।"
  },
  payment: {
    fr: "💳 Je vais vous aider avec votre paiement.",
    en: "💳 I'll help you with your payment.",
    bn: "💳 আমি আপনার পেমেন্টে সাহায্য করব।"
  },
  agent: {
    fr: "👨‍💼 Bien sûr ! Je vais transmettre votre demande à un conseiller AMI Voyages.",
    en: "👨‍💼 Of course! I'll forward your request to an AMI Voyages advisor.",
    bn: "👨‍💼 অবশ্যই! আমি আপনার অনুরোধ AMI Voyages-এর একজন উপদেষ্টার কাছে পাঠাব।"
  }
};

// =====================================================================
// REPONSES DIRECTES (intents sans flux)
// =====================================================================
const DIRECT_RESPONSES = {
  horaires_ouverture: {
    fr: "🕐 *Nos horaires d'ouverture :*\n\n📍 *Paris Gare du Nord*\n157 rue Lafayette, 75010 Paris\nLundi – Samedi : 10h00 – 18h30\n\n📍 *Aubervilliers Quatre Chemins*\n100 av. de la République, 93300 Aubervilliers\nMardi – Vendredi : 10h00 – 18h30\n\nVous pouvez aussi nous écrire ici sur WhatsApp à tout moment.",
    en: "🕐 *Our opening hours:*\n\n📍 *Paris Gare du Nord*\n157 rue Lafayette, 75010 Paris\nMonday – Saturday: 10:00am – 6:30pm\n\n📍 *Aubervilliers Quatre Chemins*\n100 av. de la République, 93300 Aubervilliers\nTuesday – Friday: 10:00am – 6:30pm\n\nYou can also write to us here on WhatsApp at any time.",
    bn: "🕐 *আমাদের সময়সূচি:*\n\n📍 *Paris Gare du Nord*\n157 rue Lafayette, 75010 Paris\nসোমবার – শনিবার: সকাল ১০টা – সন্ধ্যা ৬:৩০টা\n\n📍 *Aubervilliers Quatre Chemins*\n100 av. de la République, 93300 Aubervilliers\nমঙ্গলবার – শুক্রবার: সকাল ১০টা – সন্ধ্যা ৬:৩০টা\n\nআপনি যেকোনো সময় WhatsApp-এও লিখতে পারেন।"
  },
  localisation_agences: {
    fr: "📍 *Nos agences AMI Voyages :*\n\n🏢 *Paris Gare du Nord*\n157 rue Lafayette, 75010 Paris\n(Métro Gare du Nord)\n\n🏢 *Aubervilliers Quatre Chemins*\n100 av. de la République, 93300 Aubervilliers\n(Métro Quatre Chemins, ligne 7)",
    en: "📍 *Our AMI Voyages offices:*\n\n🏢 *Paris Gare du Nord*\n157 rue Lafayette, 75010 Paris\n(Metro Gare du Nord)\n\n🏢 *Aubervilliers Quatre Chemins*\n100 av. de la République, 93300 Aubervilliers\n(Metro Quatre Chemins, line 7)",
    bn: "📍 *আমাদের AMI Voyages শাখা:*\n\n🏢 *Paris Gare du Nord*\n157 rue Lafayette, 75010 Paris\n(মেট্রো Gare du Nord)\n\n🏢 *Aubervilliers Quatre Chemins*\n100 av. de la République, 93300 Aubervilliers\n(মেট্রো Quatre Chemins, লাইন ৭)"
  },
  bus: {
    fr: "🚫 Non, AMI Voyages propose uniquement des voyages *aériens*. Nous sommes spécialisés dans les destinations d'Asie du Sud (Bangladesh, Inde, Sri Lanka) et d'Afrique subsaharienne (Mali, Sénégal, Guinée, RDC).",
    en: "🚫 No, AMI Voyages only offers *air travel*. We specialize in South Asian destinations (Bangladesh, India, Sri Lanka) and sub-Saharan Africa (Mali, Senegal, Guinea, DRC).",
    bn: "🚫 না, AMI Voyages শুধুমাত্র *বিমান ভ্রমণ* অফার করে। আমরা দক্ষিণ এশিয়া (বাংলাদেশ, ভারত, শ্রীলঙ্কা) এবং আফ্রিকায় (মালি, সেনেগাল, গিনি, DRC) বিশেষজ্ঞ।"
  },
  appel_non_repondu: {
    fr: "😔 Nous sommes désolés si vous n'avez pas reçu de réponse. Laissez-nous votre numéro et le sujet de votre demande, un conseiller vous recontactera dès que possible.",
    en: "😔 We're sorry if you didn't receive a response. Please leave us your number and the subject of your request, and an advisor will get back to you as soon as possible.",
    bn: "😔 দ্রুত সাড়া না পেলে আমরা দুঃখিত। আপনার নম্বর এবং অনুরোধের বিষয় রেখে যান, একজন উপদেষ্টা শীঘ্রই যোগাযোগ করবেন।"
  },
  agent_disponible: {
    fr: "👥 Nos conseillers sont disponibles selon leur planning. Nous répondons rapidement pendant les horaires d'ouverture. En dehors, vous pouvez déjà nous laisser votre demande ici.",
    en: "👥 Our advisors are available according to their schedule. We respond quickly during opening hours. Outside these hours, you can already leave your request here.",
    bn: "👥 আমাদের উপদেষ্টারা সময়সূচি অনুযায়ী উপলব্ধ। খোলার সময়ে দ্রুত সাড়া দেওয়া হয়। অন্য সময়ে এখানে অনুরোধ রেখে যান।"
  },
  delai_reponse: {
    fr: "⏱ Nous faisons de notre mieux pour répondre rapidement pendant les horaires d'ouverture. En dehors de ces horaires, vous pouvez nous laisser votre demande ici sur WhatsApp.",
    en: "⏱ We do our best to respond quickly during opening hours. Outside these hours, you can leave your request here on WhatsApp.",
    bn: "⏱ আমরা খোলার সময়ে দ্রুত সাড়া দেওয়ার চেষ্টা করি। অন্য সময়ে এখানে WhatsApp-এ অনুরোধ রেখে যান।"
  },
  duree_minimum: {
    fr: "📅 Durée minimum de séjour : en *Asie* généralement 5 à 7 jours, en *Afrique* généralement 3 jours, selon la compagnie aérienne.",
    en: "📅 Minimum stay: in *Asia* generally 5 to 7 days, in *Africa* generally 3 days, depending on the airline.",
    bn: "📅 সর্বনিম্ন থাকা: *এশিয়ায়* সাধারণত ৫ থেকে ৭ দিন, *আফ্রিকায়* সাধারণত ৩ দিন, এয়ারলাইনের উপর নির্ভর করে।"
  },
  remerciement: {
    fr: "😊 Avec plaisir ! Je reste à votre disposition pour votre voyage.",
    en: "😊 You're welcome! I remain available to help with your trip.",
    bn: "😊 আপনার স্বাগত! আপনার ভ্রমণে সহায়তার জন্য আমি সর্বদা প্রস্তুত।"
  },
  ca_va: {
    fr: "😊 Très bien, merci ! Bienvenue chez AMI Voyages. Comment puis-je vous aider ?",
    en: "😊 Very well, thank you! Welcome to AMI Voyages. How can I help you?",
    bn: "😊 অনেক ভালো, ধন্যবাদ! AMI Voyages-এ স্বাগতম। আমি কীভাবে সাহায্য করতে পারি?"
  },
  salutation: {
    fr: "👋 Bonjour ! Bienvenue chez AMI Voyages, spécialisée dans les vols vers l'Asie du Sud et l'Afrique subsaharienne.",
    en: "👋 Hello! Welcome to AMI Voyages, specialized in flights to South Asia and sub-Saharan Africa.",
    bn: "👋 হ্যালো! AMI Voyages-এ স্বাগতম, আমরা দক্ষিণ এশিয়া ও আফ্রিকায় ফ্লাইটে বিশেষজ্ঞ।"
  },
  salam: {
    fr: "🤝 Walaikum salam ! Bienvenue chez AMI Voyages. Comment puis-je vous aider ?",
    en: "🤝 Walaikum assalam! Welcome to AMI Voyages. How can I help you?",
    bn: "🤝 ওয়ালাইকুম আসালাম! AMI Voyages-এ স্বাগতম। আমি কীভাবে সাহায্য করতে পারি?"
  },
  au_revoir: {
    fr: "👋 Merci pour votre message. À bientôt chez AMI Voyages !",
    en: "👋 Thank you for your message. See you soon at AMI Voyages!",
    bn: "👋 আপনার বার্তার জন্য ধন্যবাদ। AMI Voyages-এ শীঘ্রই দেখা হবে!"
  },
  // Réponses directes pour sous-menus visa_docs
  sub_pregnancy: {
    fr: "🤰 Les femmes enceintes peuvent généralement voyager jusqu'à *6 mois de grossesse*. Au-delà, une autorisation médicale est requise, sous réserve d'acceptation de la compagnie. Consultez aussi votre médecin.",
    en: "🤰 Pregnant women can generally travel up to *6 months of pregnancy*. Beyond that, a medical authorization is required, subject to airline acceptance. We also recommend consulting your doctor.",
    bn: "🤰 গর্ভবতী মহিলারা সাধারণত *গর্ভাবস্থার ৬ মাস* পর্যন্ত ভ্রমণ করতে পারেন। এর বেশি হলে চিকিৎসা অনুমতি প্রয়োজন, এয়ারলাইনের অনুমোদন সাপেক্ষে। আপনার ডাক্তারের সাথেও পরামর্শ করুন।"
  },
  sub_baby: {
    fr: "👶 *Tarif bébé/enfant :*\n• 1 jour – 2 ans : bébé, paie généralement les taxes aéroport\n• 2 – 12 ans : enfant\n• 12 ans et + : adulte\n\n*Bagages bébé :* droit aux bagages en général (ex: 23 kg chez Saudia). Varie selon la compagnie.",
    en: "👶 *Baby/child fares:*\n• 1 day – 2 years: baby, generally pays airport taxes only\n• 2 – 12 years: child\n• 12 years and +: adult\n\n*Baby luggage:* entitled to luggage in general (e.g. 23 kg with Saudia). Varies by airline.",
    bn: "👶 *শিশুর ভাড়া:*\n• ১ দিন – ২ বছর: শিশু, সাধারণত শুধু বিমানবন্দর কর দেয়\n• ২ – ১২ বছর: শিশু\n• ১২ বছর ও তার বেশি: প্রাপ্তবয়স্ক\n\n*শিশুর লাগেজ:* সাধারণত লাগেজ ভাতা পায় (যেমন Saudia-তে ২৩ কেজি)। এয়ারলাইন অনুযায়ী পরিবর্তন হয়।"
  },
  sub_payment_methods: {
    fr: "💳 *Modes de paiement acceptés :*\n• Virement bancaire\n• Espèces\n• Chèques ANCV / chèques-vacances Connect\n• Lien de paiement en ligne (carte bancaire)\n• Paiement en plusieurs fois possible sous conditions",
    en: "💳 *Accepted payment methods:*\n• Bank transfer\n• Cash\n• ANCV vouchers / holiday vouchers Connect\n• Online payment link (card)\n• Installment payments possible under certain conditions",
    bn: "💳 *গ্রহণযোগ্য পেমেন্ট পদ্ধতি:*\n• ব্যাংক ট্রান্সফার\n• নগদ\n• ANCV ভাউচার / ছুটির ভাউচার\n• অনলাইন পেমেন্ট লিংক (কার্ড)\n• নির্দিষ্ট শর্তে কিস্তিতে পেমেন্ট সম্ভব"
  },
  sub_online_payment: {
    fr: "💻 Oui, nous pouvons envoyer un *lien de paiement sécurisé* par carte bancaire. Il faut nous fournir votre facture d'achat ou la copie du passeport du passager. Voulez-vous qu'un conseiller vous envoie un lien ?",
    en: "💻 Yes, we can send a *secure payment link* by card. You'll need to provide your invoice or the passenger's passport copy. Would you like an advisor to send you a link?",
    bn: "💻 হ্যাঁ, আমরা কার্ডে *নিরাপদ পেমেন্ট লিংক* পাঠাতে পারি। আপনার চালান বা পাসপোর্টের কপি দিতে হবে। একজন উপদেষ্টা আপনাকে লিংক পাঠাবেন?"
  }
};

// =====================================================================
// CONSTRUCTION DU RECAPITULATIF (handoff)
// =====================================================================
function buildSummary(flowName, submenuChoice, collectedData, lang) {
  const labels = {
    fr: {
      destination: 'Destination', depart_city: 'Départ', return_city: 'Retour',
      depart_date: 'Date de départ', return_date: 'Date de retour',
      passengers: 'Passagers', preference: 'Préférence',
      reference: 'Référence', passenger_name: 'Passager', phone: 'Téléphone',
      exact_request: 'Demande', nationality: 'Nationalité',
      expiry_date: 'Expiration passeport', name: 'Nom', subject: 'Sujet'
    },
    en: {
      destination: 'Destination', depart_city: 'Departure', return_city: 'Return',
      depart_date: 'Departure date', return_date: 'Return date',
      passengers: 'Passengers', preference: 'Preference',
      reference: 'Reference', passenger_name: 'Passenger', phone: 'Phone',
      exact_request: 'Request', nationality: 'Nationality',
      expiry_date: 'Passport expiry', name: 'Name', subject: 'Subject'
    },
    bn: {
      destination: 'গন্তব্য', depart_city: 'ছাড়ার শহর', return_city: 'ফেরার শহর',
      depart_date: 'যাত্রার তারিখ', return_date: 'ফেরার তারিখ',
      passengers: 'যাত্রী', preference: 'পছন্দ',
      reference: 'রেফারেন্স', passenger_name: 'যাত্রীর নাম', phone: 'ফোন',
      exact_request: 'অনুরোধ', nationality: 'জাতীয়তা',
      expiry_date: 'পাসপোর্টের মেয়াদ', name: 'নাম', subject: 'বিষয়'
    }
  };

  const submenuLabels = {
    fr: { sub_modify: 'Modification de billet', sub_change_date: 'Changement de date', sub_cancel: 'Annulation de billet', sub_flight_cancelled: 'Vol annulé/retardé', sub_visa: 'Demande de visa', sub_passport: 'Passeport', sub_docs: 'Documents de voyage', sub_payment_link: 'Lien de paiement', sub_remote_payment: 'Paiement à distance' },
    en: { sub_modify: 'Ticket modification', sub_change_date: 'Date change', sub_cancel: 'Ticket cancellation', sub_flight_cancelled: 'Flight cancelled/delayed', sub_visa: 'Visa request', sub_passport: 'Passport', sub_docs: 'Travel documents', sub_payment_link: 'Payment link', sub_remote_payment: 'Remote payment' },
    bn: { sub_modify: 'টিকেট পরিবর্তন', sub_change_date: 'তারিখ পরিবর্তন', sub_cancel: 'টিকেট বাতিল', sub_flight_cancelled: 'ফ্লাইট বাতিল/দেরি', sub_visa: 'ভিসার আবেদন', sub_passport: 'পাসপোর্ট', sub_docs: 'ভ্রমণ কাগজপত্র', sub_payment_link: 'পেমেন্ট লিংক', sub_remote_payment: 'দূরবর্তী পেমেন্ট' }
  };

  const l = lang || 'fr';
  const lb = labels[l] || labels.fr;
  const slb = submenuLabels[l] || submenuLabels.fr;

  let lines = [];
  if (submenuChoice && slb[submenuChoice]) {
    lines.push(`• ${slb[submenuChoice]}`);
  }
  for (const [key, value] of Object.entries(collectedData || {})) {
    if (value && lb[key]) {
      lines.push(`• ${lb[key]} : ${value}`);
    }
  }
  return lines.join('\n');
}

function buildHandoffMessage(flowName, submenuChoice, collectedData, lang) {
  const summary = buildSummary(flowName, submenuChoice, collectedData, lang);
  const msgs = {
    fr: `✅ Merci pour ces informations. Voici le récapitulatif de votre demande :\n\n${summary}\n\nUn conseiller AMI Voyages va prendre en charge votre dossier et vous contactera très prochainement. 📞`,
    en: `✅ Thank you for this information. Here is a summary of your request:\n\n${summary}\n\nAn AMI Voyages advisor will handle your file and contact you very soon. 📞`,
    bn: `✅ এই তথ্যের জন্য ধন্যবাদ। আপনার অনুরোধের সারসংক্ষেপ:\n\n${summary}\n\nAMI Voyages-এর একজন উপদেষ্টা আপনার ফাইল পরিচালনা করবেন এবং শীঘ্রই যোগাযোগ করবেন। 📞`
  };
  return msgs[lang] || msgs.fr;
}

module.exports = {
  TEXTS, t,
  LANG_PICKER, MAIN_MENU, SUBMENUS, PREFERENCE_BUTTONS,
  FLOW_PROMPTS, FLOW_INTROS, DIRECT_RESPONSES,
  buildSummary, buildHandoffMessage
};