'use strict';

// =====================================================================
// SESSIONS — état conversationnel par utilisateur
// =====================================================================
const SESSIONS = new Map();
const PROCESSED_MESSAGES = new Map();

function createSession() {
  return {
    selectedLanguage: null,
    awaitingLangSelection: true,
    currentFlow: null,
    currentStep: -1,
    submenuChoice: null,
    collectedData: {},
    awaitingHuman: false,
    handoffData: null,
    lastIntent: null,
    timestamp: Date.now()
  };
}

function saveSession(user, data) {
  const s = SESSIONS.get(user) || createSession();
  Object.assign(s, data);
  s.timestamp = Date.now();
  SESSIONS.set(user, s);
}

function getSession(user) {
  const s = SESSIONS.get(user);
  if (!s) return null;
  return s;
}

function clearSession(user) {
  SESSIONS.delete(user);
}

// Remet uniquement les données de flux, conserve langue et awaitingHuman
function resetFlow(user) {
  const s = SESSIONS.get(user);
  if (!s) return;
  s.currentFlow = null;
  s.currentStep = -1;
  s.submenuChoice = null;
  s.collectedData = {};
  s.timestamp = Date.now();
  SESSIONS.set(user, s);
}

// =====================================================================
// PROTECTION ANTI-DOUBLONS WEBHOOK
// =====================================================================
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

// Nettoyage périodique
setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of PROCESSED_MESSAGES) {
    if (now - ts > 15 * 60 * 1000) PROCESSED_MESSAGES.delete(id);
  }
  // Sessions expirées après 24h
  for (const [user, session] of SESSIONS) {
    if (now - session.timestamp > 24 * 60 * 60 * 1000) SESSIONS.delete(user);
  }
}, 10 * 60 * 1000);

module.exports = {
  createSession,
  saveSession,
  getSession,
  clearSession,
  resetFlow,
  isMessageProcessed,
  markMessageProcessed
};