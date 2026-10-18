/* Bern Expertise Navigator — vanilla JS, no dependencies (runs air-gapped). */
(() => {
  "use strict";

  /* ======================= utilities ======================= */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const isNarrow = () => matchMedia("(max-width: 1100px)").matches;
  function hostPath(u) { try { const x = new URL(u); return x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/index_\w+\.html$|\/$/, ""); } catch { return u; } }
  function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2200); }

  const ICON = {
    plus: '<svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    back: '<svg class="i" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    unit: '<svg viewBox="0 0 24 24"><path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6"/></svg>',
    project: '<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7 15h10"/></svg>',
    infrastructure: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/></svg>',
    link: '<svg class="i" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
    ext: '<svg class="i" viewBox="0 0 24 24"><path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>',
    check: '<svg class="i" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    mail: '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    cal: '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    copy: '<svg class="i" viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    info: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>',
    shield: '<svg class="i" viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="M12 8v5M12 16h.01"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    send: '<svg class="i" viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>',
    inbox: '<svg class="i" viewBox="0 0 24 24"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/></svg>',
    sparkle: '<svg class="i" viewBox="0 0 24 24"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
    trash: '<svg class="i" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/></svg>',
  };

  /* ======================= i18n ======================= */
  const I18N = {
    en: {
      tagline: "Bring companies to Bern", "nav.requests": "Requests", "nav.review": "Review", "nav.explore": "Explore Bern",
      "foot.data": "Facts come only from the institutions' public websites; every claim links to its source.",
      "me.title": "Who is using the navigator?", "me.hint": "Stored only in this browser. Switch role to try the technical review.",
      "me.name": "Your name", "me.email": "Your email", "me.team": "Team / signature", "me.role": "Role",
      "role.officer": "Business development", "role.reviewer": "Technical reviewer", cancel: "Cancel", save: "Save",
      "st.new": "New", "st.in_review": "In technical review", "st.changes_requested": "Changes requested", "st.approved": "Ready to invite",
      "st.contacted": "Invited", "st.call_scheduled": "Call scheduled", "st.closed": "Closed",
      "req.title": "Turn company requests into investments in Bern",
      "req.lead": "Paste what a company is asking for. The navigator explains it in plain words, finds the right researchers, labs and facilities in Bern, gets your technical colleague's OK, and drafts the invitation.",
      "req.new": "New request", "req.explore": "Explore Bern",
      "flow.1": "Understand", "flow.1d": "Plain-language summary and jargon explained",
      "flow.2": "Match", "flow.2d": "Experts, labs and facilities in Bern, with sources",
      "flow.3": "Review", "flow.3d": "A technical colleague checks the fit",
      "flow.4": "Invite", "flow.4d": "Email or call to bring them to Bern",
      "kpi.open": "open requests", "kpi.review": "waiting for review", "kpi.ready": "ready to invite", "kpi.invited": "companies invited",
      "col.todo": "To do", "col.review": "In review", "col.ready": "Ready to invite", "col.done": "Invited",
      "col.empty": "Nothing here yet", "board.emptyTitle": "No requests yet",
      "board.emptyText": "Start with a real request, or try one of the fictional examples.", "partners": "partners",
      "new.title": "New company request", "new.lead": "Paste the email or message from the company. Technical words are fine — the navigator explains them.",
      "f.company": "Company", "f.contact": "Contact person", "f.email": "Contact email", "f.country": "Country",
      "f.request": "What is the company asking for?", "f.requestHint": "Any language: English, German, French…",
      "new.submit": "Understand & find partners", "new.examples": "Try a fictional example",
      "new.next": "What happens next", "new.next1": "A plain-language summary with every technical word explained",
      "new.next2": "Matching experts, labs and facilities in Bern — each linked to its public source",
      "new.next3": "You pick partners and send them to a technical colleague for review",
      "new.working": "Reading the request and searching Bern's research landscape…",
      "case.back": "All requests", "case.received": "Received", "case.contact": "Contact",
      "step.1": "Understand", "step.2": "Choose partners", "step.3": "Technical review", "step.4": "Invite to Bern",
      "p1.title": "In plain words", "p1.ai": "Summary by Apertus", "p1.rules": "Glossary-based (Apertus offline)",
      "p1.does": "What the company does", "p1.needs": "What they need", "p1.words": "Words explained",
      "p1.glossary": "reviewed glossary", "p1.aiterm": "AI explanation – check", "p1.orig": "Show the original request",
      "p1.noterms": "No technical terms from the glossary found.",
      "p2.title": "Possible partners in Bern", "p2.lead": "Tick the partners you want to propose. Each one is backed by a public web page.",
      "p2.rematch": "Search again", "p2.more": "Find more in Explore", "p2.selected": "selected", "p2.none": "No matching partners found in the indexed sources.",
      "p2.source": "source", "p2.via": "via", "p2.ok": "Reviewer: OK", "p2.no": "Reviewer: not suitable",
      "p3.title": "Technical review", "p3.lead": "Ask a colleague who knows the field to check the selected partners.",
      "p3.reviewer": "Reviewer", "p3.note": "Note for the reviewer", "p3.send": "Send for review",
      "p3.needSel": "Select at least one partner first.",
      "p3.waiting": "Waiting for {who} to review {n} partner(s).", "p3.switch": "Open as reviewer (demo)",
      "p3.changes": "{who} asked for changes", "p3.approved": "{who} approved {n} partner(s)",
      "p3.rv.lead": "Check each proposed partner. Technical details and the original sources are one click away.",
      "p3.rv.ok": "Suitable", "p3.rv.no": "Not suitable", "p3.rv.note": "Comment (optional)", "p3.rv.details": "Technical details",
      "p3.rv.comment": "Overall comment to the business developer", "p3.rv.approve": "Approve", "p3.rv.changes": "Request changes",
      "p4.title": "Invite to Bern", "p4.locked": "Available once the technical review has approved the partners.",
      "p4.lang": "Email language", "p4.slots": "Propose call times", "p4.duration": "Call length (min)",
      "p4.prepare": "Prepare invitation email", "p4.subject": "Subject", "p4.body": "Email (you can edit it)",
      "p4.open": "Open in email app", "p4.copy": "Copy text", "p4.sent": "Mark as sent",
      "p4.ics": "Calendar invite (.ics)",
      "p4.doneEmail": "Invitation sent on {d}.", "p4.doneCall": "Call scheduled: {d}.",
      "side.activity": "Activity", "side.delete": "Delete request", "side.confirmDelete": "Delete this request permanently?",
      "rv.title": "Technical review queue", "rv.lead": "Requests waiting for a technical check of the proposed Bern partners.",
      "rv.empty": "Nothing to review right now.", "rv.mine": "assigned to you",
      "ex.title": "Find the expertise behind Bern's <em>innovation</em>",
      "ex.lead": "Researchers, labs, projects and facilities from the public websites of UniBE, ARTORG and Diabetes Center Berne — every result linked to its source.",
      "ex.ph": "e.g. glucose sensors, robots for neurosurgery, 3D printing service…", "ex.search": "Search",
      "ex.ctx": "Adding partners to the request from {c}", "ex.ctxBack": "Back to the request",
      "ex.proof": "Bern in numbers", "ex.proofNote": "quoted from the institutions' own pages",
      "ex.themes": "Research strengths", "ex.themesNote": "live from the index — click to explore",
      "ex.fac": "Facilities companies can use", "ex.labs": "Labs and research groups", "ex.engage": "Ways to engage",
      "ex.people": "people", "ex.labsN": "labs", "ex.projects": "projects",
      "ex.lead_": "Lead", "ex.results": "results", "ex.also": "also searched", "ex.why": "Why",
      "ex.verified": "Source-verified", "ex.cites": "citations", "ex.found": "Found through",
      "ex.none": "No answer without a source", "ex.noneHint": "The navigator only answers from pages it has indexed, and never guesses names or expertise.",
      "ex.add": "Add to request", "ex.added": "Added to the request", "ex.open": "Open source page",
      "ex.about": "About", "ex.evidence": "Evidence", "ex.linked": "People & linked entities", "ex.expertise": "Expertise",
      "ex.select": "Select a result to see every cited source.", "ex.abstainChip": "pizza delivery? (honest “no source”)",
      "type.person": "Person", "type.unit": "Lab / unit", "type.project": "Project", "type.infrastructure": "Facility",
      "f.people": "People", "f.labs": "Labs", "f.projects": "Projects", "f.facilities": "Facilities",
      "llm.on": "{m} online", "llm.off": "{m} offline · rules mode",
      "llm.onT": "Apertus is on: plain-language summaries, query expansion and explanations.",
      "llm.offT": "Apertus endpoint not reachable: the reviewed glossary and deterministic rules are used. Nothing is invented either way.",
      "err": "Something went wrong", "saved": "Saved",
    },
    de: {
      tagline: "Firmen nach Bern holen", "nav.requests": "Anfragen", "nav.review": "Prüfung", "nav.explore": "Bern entdecken",
      "foot.data": "Fakten stammen nur von den öffentlichen Websites der Institutionen; jede Aussage ist mit ihrer Quelle verlinkt.",
      "me.title": "Wer nutzt den Navigator?", "me.hint": "Nur in diesem Browser gespeichert. Rolle wechseln, um die technische Prüfung auszuprobieren.",
      "me.name": "Ihr Name", "me.email": "Ihre E-Mail", "me.team": "Team / Signatur", "me.role": "Rolle",
      "role.officer": "Wirtschaftsförderung", "role.reviewer": "Technische Prüfung", cancel: "Abbrechen", save: "Speichern",
      "st.new": "Neu", "st.in_review": "In technischer Prüfung", "st.changes_requested": "Änderungen gewünscht", "st.approved": "Bereit zur Einladung",
      "st.contacted": "Eingeladen", "st.call_scheduled": "Gespräch geplant", "st.closed": "Abgeschlossen",
      "req.title": "Aus Firmenanfragen werden Investitionen in Bern",
      "req.lead": "Fügen Sie ein, was eine Firma sucht. Der Navigator erklärt es in einfachen Worten, findet passende Forschende, Labore und Infrastruktur in Bern, holt das OK Ihrer Fachkollegin ein und entwirft die Einladung.",
      "req.new": "Neue Anfrage", "req.explore": "Bern entdecken",
      "flow.1": "Verstehen", "flow.1d": "Zusammenfassung in einfacher Sprache, Fachbegriffe erklärt",
      "flow.2": "Zuordnen", "flow.2d": "Fachleute, Labore und Infrastruktur in Bern, mit Quellen",
      "flow.3": "Prüfen", "flow.3d": "Eine Fachperson prüft die Passung",
      "flow.4": "Einladen", "flow.4d": "E-Mail oder Gespräch, um sie nach Bern zu holen",
      "kpi.open": "offene Anfragen", "kpi.review": "warten auf Prüfung", "kpi.ready": "bereit zur Einladung", "kpi.invited": "Firmen eingeladen",
      "col.todo": "Zu erledigen", "col.review": "In Prüfung", "col.ready": "Bereit zur Einladung", "col.done": "Eingeladen",
      "col.empty": "Noch nichts", "board.emptyTitle": "Noch keine Anfragen",
      "board.emptyText": "Beginnen Sie mit einer echten Anfrage oder probieren Sie ein fiktives Beispiel.", "partners": "Partner",
      "new.title": "Neue Firmenanfrage", "new.lead": "Fügen Sie die E-Mail oder Nachricht der Firma ein. Fachbegriffe sind kein Problem — der Navigator erklärt sie.",
      "f.company": "Firma", "f.contact": "Kontaktperson", "f.email": "E-Mail der Kontaktperson", "f.country": "Land",
      "f.request": "Was sucht die Firma?", "f.requestHint": "Jede Sprache: Deutsch, Englisch, Französisch…",
      "new.submit": "Verstehen & Partner finden", "new.examples": "Fiktives Beispiel ausprobieren",
      "new.next": "Was als Nächstes passiert", "new.next1": "Eine Zusammenfassung in einfacher Sprache, jeder Fachbegriff erklärt",
      "new.next2": "Passende Fachleute, Labore und Infrastruktur in Bern — jeweils mit öffentlicher Quelle",
      "new.next3": "Sie wählen Partner aus und senden sie einer Fachperson zur Prüfung",
      "new.working": "Die Anfrage wird gelesen und die Berner Forschungslandschaft durchsucht…",
      "case.back": "Alle Anfragen", "case.received": "Eingegangen", "case.contact": "Kontakt",
      "step.1": "Verstehen", "step.2": "Partner wählen", "step.3": "Technische Prüfung", "step.4": "Nach Bern einladen",
      "p1.title": "In einfachen Worten", "p1.ai": "Zusammenfassung von Apertus", "p1.rules": "Glossar-basiert (Apertus offline)",
      "p1.does": "Was die Firma macht", "p1.needs": "Was sie braucht", "p1.words": "Fachbegriffe erklärt",
      "p1.glossary": "geprüftes Glossar", "p1.aiterm": "KI-Erklärung – prüfen", "p1.orig": "Originalanfrage anzeigen",
      "p1.noterms": "Keine Fachbegriffe aus dem Glossar gefunden.",
      "p2.title": "Mögliche Partner in Bern", "p2.lead": "Wählen Sie die Partner, die Sie vorschlagen möchten. Jeder ist durch eine öffentliche Webseite belegt.",
      "p2.rematch": "Neu suchen", "p2.more": "Mehr in «Bern entdecken»", "p2.selected": "ausgewählt", "p2.none": "Keine passenden Partner in den indexierten Quellen gefunden.",
      "p2.source": "Quelle", "p2.via": "über", "p2.ok": "Prüfung: OK", "p2.no": "Prüfung: nicht passend",
      "p3.title": "Technische Prüfung", "p3.lead": "Bitten Sie eine Fachperson, die ausgewählten Partner zu prüfen.",
      "p3.reviewer": "Prüfperson", "p3.note": "Notiz für die Prüfperson", "p3.send": "Zur Prüfung senden",
      "p3.needSel": "Bitte zuerst mindestens einen Partner auswählen.",
      "p3.waiting": "Wartet auf die Prüfung von {n} Partner(n) durch {who}.", "p3.switch": "Als Prüfperson öffnen (Demo)",
      "p3.changes": "{who} wünscht Änderungen", "p3.approved": "{who} hat {n} Partner freigegeben",
      "p3.rv.lead": "Prüfen Sie jeden vorgeschlagenen Partner. Technische Details und die Originalquellen sind einen Klick entfernt.",
      "p3.rv.ok": "Passend", "p3.rv.no": "Nicht passend", "p3.rv.note": "Kommentar (optional)", "p3.rv.details": "Technische Details",
      "p3.rv.comment": "Gesamtkommentar an die Wirtschaftsförderung", "p3.rv.approve": "Freigeben", "p3.rv.changes": "Änderungen anfordern",
      "p4.title": "Nach Bern einladen", "p4.locked": "Verfügbar, sobald die technische Prüfung die Partner freigegeben hat.",
      "p4.lang": "Sprache der E-Mail", "p4.slots": "Gesprächstermine vorschlagen", "p4.duration": "Dauer (Min.)",
      "p4.prepare": "Einladung vorbereiten", "p4.subject": "Betreff", "p4.body": "E-Mail (bearbeitbar)",
      "p4.open": "Im E-Mail-Programm öffnen", "p4.copy": "Text kopieren", "p4.sent": "Als gesendet markieren",
      "p4.ics": "Kalendereinladung (.ics)",
      "p4.doneEmail": "Einladung gesendet am {d}.", "p4.doneCall": "Gespräch geplant: {d}.",
      "side.activity": "Verlauf", "side.delete": "Anfrage löschen", "side.confirmDelete": "Diese Anfrage endgültig löschen?",
      "rv.title": "Technische Prüfungen", "rv.lead": "Anfragen, deren vorgeschlagene Berner Partner fachlich geprüft werden müssen.",
      "rv.empty": "Zurzeit nichts zu prüfen.", "rv.mine": "Ihnen zugewiesen",
      "ex.title": "Die Expertise hinter Berns <em>Innovation</em> finden",
      "ex.lead": "Forschende, Labore, Projekte und Infrastruktur von den öffentlichen Websites der UniBE, des ARTORG und des Diabetes Center Berne — jedes Ergebnis mit Quelle.",
      "ex.ph": "z. B. Glukosesensoren, Roboter für die Neurochirurgie, 3D-Druck…", "ex.search": "Suchen",
      "ex.ctx": "Partner für die Anfrage von {c} hinzufügen", "ex.ctxBack": "Zurück zur Anfrage",
      "ex.proof": "Bern in Zahlen", "ex.proofNote": "zitiert von den Seiten der Institutionen",
      "ex.themes": "Forschungsstärken", "ex.themesNote": "live aus dem Index — zum Entdecken klicken",
      "ex.fac": "Infrastruktur für Firmen", "ex.labs": "Labore und Forschungsgruppen", "ex.engage": "Wege zur Zusammenarbeit",
      "ex.people": "Personen", "ex.labsN": "Labore", "ex.projects": "Projekte",
      "ex.lead_": "Leitung", "ex.results": "Ergebnisse", "ex.also": "auch gesucht", "ex.why": "Warum",
      "ex.verified": "Quelle geprüft", "ex.cites": "Belege", "ex.found": "Gefunden über",
      "ex.none": "Keine Antwort ohne Quelle", "ex.noneHint": "Der Navigator antwortet nur aus indexierten Seiten und rät nie Namen oder Fachgebiete.",
      "ex.add": "Zur Anfrage hinzufügen", "ex.added": "Zur Anfrage hinzugefügt", "ex.open": "Quellseite öffnen",
      "ex.about": "Über", "ex.evidence": "Belege", "ex.linked": "Personen & verknüpfte Einträge", "ex.expertise": "Fachgebiete",
      "ex.select": "Ergebnis wählen, um alle Belege zu sehen.", "ex.abstainChip": "Pizzakurier? (ehrlich: «keine Quelle»)",
      "type.person": "Person", "type.unit": "Labor / Gruppe", "type.project": "Projekt", "type.infrastructure": "Infrastruktur",
      "f.people": "Personen", "f.labs": "Labore", "f.projects": "Projekte", "f.facilities": "Infrastruktur",
      "llm.on": "{m} online", "llm.off": "{m} offline · Regelmodus",
      "llm.onT": "Apertus ist aktiv: Zusammenfassungen in einfacher Sprache, Suchbegriffe und Erklärungen.",
      "llm.offT": "Apertus nicht erreichbar: geprüftes Glossar und feste Regeln werden verwendet. Erfunden wird so oder so nichts.",
      "err": "Etwas ist schiefgelaufen", "saved": "Gespeichert",
    },
    fr: {
      tagline: "Attirer les entreprises à Berne", "nav.requests": "Demandes", "nav.review": "Validation", "nav.explore": "Explorer Berne",
      "foot.data": "Les faits proviennent uniquement des sites publics des institutions ; chaque affirmation renvoie à sa source.",
      "me.title": "Qui utilise le navigateur ?", "me.hint": "Enregistré uniquement dans ce navigateur. Changez de rôle pour essayer la validation technique.",
      "me.name": "Votre nom", "me.email": "Votre e-mail", "me.team": "Équipe / signature", "me.role": "Rôle",
      "role.officer": "Promotion économique", "role.reviewer": "Validation technique", cancel: "Annuler", save: "Enregistrer",
      "st.new": "Nouvelle", "st.in_review": "En validation technique", "st.changes_requested": "Modifications demandées", "st.approved": "Prête à inviter",
      "st.contacted": "Invitée", "st.call_scheduled": "Appel planifié", "st.closed": "Close",
      "req.title": "Transformer les demandes d'entreprises en investissements à Berne",
      "req.lead": "Collez la demande d'une entreprise. Le navigateur l'explique simplement, trouve les chercheurs, laboratoires et infrastructures à Berne, obtient l'accord d'un collègue technique et rédige l'invitation.",
      "req.new": "Nouvelle demande", "req.explore": "Explorer Berne",
      "flow.1": "Comprendre", "flow.1d": "Résumé simple, jargon expliqué",
      "flow.2": "Associer", "flow.2d": "Experts, laboratoires et infrastructures à Berne, avec sources",
      "flow.3": "Valider", "flow.3d": "Un collègue technique vérifie l'adéquation",
      "flow.4": "Inviter", "flow.4d": "E-mail ou appel pour les attirer à Berne",
      "kpi.open": "demandes ouvertes", "kpi.review": "en attente de validation", "kpi.ready": "prêtes à inviter", "kpi.invited": "entreprises invitées",
      "col.todo": "À traiter", "col.review": "En validation", "col.ready": "Prêtes à inviter", "col.done": "Invitées",
      "col.empty": "Rien pour l'instant", "board.emptyTitle": "Aucune demande",
      "board.emptyText": "Commencez avec une vraie demande ou essayez un exemple fictif.", "partners": "partenaires",
      "new.title": "Nouvelle demande d'entreprise", "new.lead": "Collez l'e-mail ou le message de l'entreprise. Les termes techniques ne posent pas de problème — le navigateur les explique.",
      "f.company": "Entreprise", "f.contact": "Personne de contact", "f.email": "E-mail de contact", "f.country": "Pays",
      "f.request": "Que cherche l'entreprise ?", "f.requestHint": "Toute langue : français, allemand, anglais…",
      "new.submit": "Comprendre et trouver des partenaires", "new.examples": "Essayer un exemple fictif",
      "new.next": "Étapes suivantes", "new.next1": "Un résumé simple, chaque terme technique expliqué",
      "new.next2": "Experts, laboratoires et infrastructures à Berne — chacun avec sa source publique",
      "new.next3": "Vous choisissez les partenaires et les soumettez à un collègue technique",
      "new.working": "Lecture de la demande et recherche dans le paysage bernois de la recherche…",
      "case.back": "Toutes les demandes", "case.received": "Reçue", "case.contact": "Contact",
      "step.1": "Comprendre", "step.2": "Choisir les partenaires", "step.3": "Validation technique", "step.4": "Inviter à Berne",
      "p1.title": "En termes simples", "p1.ai": "Résumé par Apertus", "p1.rules": "Basé sur le glossaire (Apertus hors ligne)",
      "p1.does": "Ce que fait l'entreprise", "p1.needs": "Ce dont elle a besoin", "p1.words": "Termes expliqués",
      "p1.glossary": "glossaire validé", "p1.aiterm": "Explication IA – à vérifier", "p1.orig": "Afficher la demande originale",
      "p1.noterms": "Aucun terme du glossaire trouvé.",
      "p2.title": "Partenaires possibles à Berne", "p2.lead": "Cochez les partenaires à proposer. Chacun est appuyé par une page web publique.",
      "p2.rematch": "Relancer", "p2.more": "Chercher dans Explorer", "p2.selected": "sélectionné(s)", "p2.none": "Aucun partenaire trouvé dans les sources indexées.",
      "p2.source": "source", "p2.via": "via", "p2.ok": "Validation : OK", "p2.no": "Validation : non adapté",
      "p3.title": "Validation technique", "p3.lead": "Demandez à un collègue du domaine de vérifier les partenaires choisis.",
      "p3.reviewer": "Validateur", "p3.note": "Note pour le validateur", "p3.send": "Envoyer en validation",
      "p3.needSel": "Sélectionnez d'abord au moins un partenaire.",
      "p3.waiting": "En attente de {who} pour {n} partenaire(s).", "p3.switch": "Ouvrir comme validateur (démo)",
      "p3.changes": "{who} demande des modifications", "p3.approved": "{who} a validé {n} partenaire(s)",
      "p3.rv.lead": "Vérifiez chaque partenaire proposé. Les détails techniques et les sources sont à un clic.",
      "p3.rv.ok": "Adapté", "p3.rv.no": "Non adapté", "p3.rv.note": "Commentaire (facultatif)", "p3.rv.details": "Détails techniques",
      "p3.rv.comment": "Commentaire général pour la promotion économique", "p3.rv.approve": "Valider", "p3.rv.changes": "Demander des modifications",
      "p4.title": "Inviter à Berne", "p4.locked": "Disponible une fois les partenaires validés techniquement.",
      "p4.lang": "Langue de l'e-mail", "p4.slots": "Proposer des créneaux d'appel", "p4.duration": "Durée (min)",
      "p4.prepare": "Préparer l'invitation", "p4.subject": "Objet", "p4.body": "E-mail (modifiable)",
      "p4.open": "Ouvrir dans la messagerie", "p4.copy": "Copier le texte", "p4.sent": "Marquer comme envoyé",
      "p4.ics": "Invitation calendrier (.ics)",
      "p4.doneEmail": "Invitation envoyée le {d}.", "p4.doneCall": "Appel planifié : {d}.",
      "side.activity": "Historique", "side.delete": "Supprimer la demande", "side.confirmDelete": "Supprimer définitivement cette demande ?",
      "rv.title": "Validations techniques", "rv.lead": "Demandes dont les partenaires bernois proposés doivent être vérifiés.",
      "rv.empty": "Rien à valider pour le moment.", "rv.mine": "qui vous est attribuée",
      "ex.title": "Trouver l'expertise derrière l'<em>innovation</em> bernoise",
      "ex.lead": "Chercheurs, laboratoires, projets et infrastructures issus des sites publics de l'UniBE, de l'ARTORG et du Diabetes Center Berne — chaque résultat avec sa source.",
      "ex.ph": "p. ex. capteurs de glucose, robots pour la neurochirurgie, impression 3D…", "ex.search": "Rechercher",
      "ex.ctx": "Ajout de partenaires à la demande de {c}", "ex.ctxBack": "Retour à la demande",
      "ex.proof": "Berne en chiffres", "ex.proofNote": "cités depuis les pages des institutions",
      "ex.themes": "Points forts de la recherche", "ex.themesNote": "en direct depuis l'index — cliquez pour explorer",
      "ex.fac": "Infrastructures ouvertes aux entreprises", "ex.labs": "Laboratoires et groupes", "ex.engage": "Comment collaborer",
      "ex.people": "personnes", "ex.labsN": "laboratoires", "ex.projects": "projets",
      "ex.lead_": "Direction", "ex.results": "résultats", "ex.also": "également cherché", "ex.why": "Pourquoi",
      "ex.verified": "Source vérifiée", "ex.cites": "citations", "ex.found": "Trouvé via",
      "ex.none": "Pas de réponse sans source", "ex.noneHint": "Le navigateur ne répond qu'à partir des pages indexées et ne devine jamais de noms ni d'expertises.",
      "ex.add": "Ajouter à la demande", "ex.added": "Ajouté à la demande", "ex.open": "Ouvrir la page source",
      "ex.about": "À propos", "ex.evidence": "Preuves", "ex.linked": "Personnes et entités liées", "ex.expertise": "Expertise",
      "ex.select": "Sélectionnez un résultat pour voir toutes les sources.", "ex.abstainChip": "livraison de pizza ? (« pas de source »)",
      "type.person": "Personne", "type.unit": "Laboratoire", "type.project": "Projet", "type.infrastructure": "Infrastructure",
      "f.people": "Personnes", "f.labs": "Laboratoires", "f.projects": "Projets", "f.facilities": "Infrastructures",
      "llm.on": "{m} en ligne", "llm.off": "{m} hors ligne · mode règles",
      "llm.onT": "Apertus est actif : résumés simples, élargissement des requêtes et explications.",
      "llm.offT": "Apertus injoignable : le glossaire validé et des règles fixes sont utilisés. Rien n'est inventé dans les deux cas.",
      "err": "Une erreur est survenue", "saved": "Enregistré",
    },
  };
  let LANG = store.get("nav-lang", null) || ((navigator.language || "en").slice(0, 2) === "de" ? "de" : (navigator.language || "").startsWith("fr") ? "fr" : "en");
  if (!I18N[LANG]) LANG = "en";
  const t = (k, v = {}) => (I18N[LANG][k] ?? I18N.en[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? "");
  const fmtDate = (iso, withTime = true) => {
    try { return new Intl.DateTimeFormat(LANG === "en" ? "en-GB" : LANG + "-CH", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(iso)); }
    catch { return iso; }
  };
  function applyStaticI18n() {
    document.documentElement.lang = LANG;
    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $("#lang").value = LANG;
  }

  /* ======================= profile ======================= */
  let me = store.get("nav-me", { name: "", email: "", team: "", role: "officer" });
  function renderMe() {
    $("#meName").textContent = me.name || "—";
    $("#meRole").textContent = t(me.role === "reviewer" ? "role.reviewer" : "role.officer");
    $("#meAv").textContent = (me.name || "?").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  }
  function openMe() {
    const f = $("#meForm");
    f.name.value = me.name; f.email.value = me.email; f.team.value = me.team;
    $$("input[name=role]", f).forEach((r) => { r.checked = r.value === me.role; });
    $("#meDlg").showModal();
  }
  function setRole(role) { me.role = role; store.set("nav-me", me); renderMe(); }

  /* ======================= API ======================= */
  async function api(path, opts = {}) {
    const r = await fetch(path, { method: opts.method || "GET", headers: opts.body ? { "Content-Type": "application/json" } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined, signal: opts.signal });
    if (!r.ok) {
      let msg = `${r.status}`;
      try { const j = await r.json(); msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail); } catch {}
      throw new Error(msg);
    }
    return r.json();
  }

  /* ======================= glossary / jargon ======================= */
  let GLOSS = { lang: null, rx: null, map: new Map() };
  async function loadGlossary() {
    if (GLOSS.lang === LANG) return;
    try {
      const g = await api(`/glossary?lang=${LANG}`);
      const map = new Map();
      for (const x of g) for (const f of x.forms) map.set(f, { term: x.term, plain: x.plain });
      const forms = [...map.keys()].sort((a, b) => b.length - a.length).map((f) => esc(f).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      GLOSS = { lang: LANG, map, rx: forms.length ? new RegExp(`(?<![\\p{L}\\p{N}-])(${forms.join("|")})(?![\\p{L}\\p{N}-])`, "giu") : null };
    } catch { GLOSS = { lang: LANG, rx: null, map: new Map() }; }
  }
  /** Escape `text` and underline technical words with a plain-language tooltip. */
  function jargon(text) {
    const h = esc(text);
    if (!GLOSS.rx) return h;
    return h.replace(GLOSS.rx, (m) => {
      const g = GLOSS.map.get(m.toLowerCase());
      return g ? `<abbr class="jargon" title="${esc(g.plain)}">${m}</abbr>` : m;
    });
  }

  /* ======================= shared rendering ======================= */
  const TITLE_RX = /^(prof\.?|dr\.?|pd|med\.?|phil\.?|em\.?|nat\.?|rer\.?|dr\.-ing\.?|ing\.?|msc|phd)$/i;
  function initialsOf(name) {
    const parts = name.split(/\s+/).filter((p) => !TITLE_RX.test(p));
    return (((parts[0] || "")[0] || "") + ((parts[parts.length - 1] || "")[0] || "")).toUpperCase();
  }
  function avatar(name, type, sm = false) {
    const inner = type === "person" ? esc(initialsOf(name)) : ICON[type] || "";
    return `<div class="avatar ${sm ? "sm " : ""}${esc(type)}" aria-hidden="true">${inner}</div>`;
  }
  const pill = (status) => `<span class="pill st-${esc(status)}">${esc(t("st." + status))}</span>`;
  function highlight(text, terms) {
    const h = esc(text);
    if (!terms.length) return h;
    const rx = new RegExp("(" + terms.map((x) => esc(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "giu");
    return h.replace(rx, "<mark>$1</mark>");
  }
  function termsFor(q, extra = []) {
    const stop = new Set("the and for with von und der die das des den ein eine in of on to at by or a an les une pour sur".split(" "));
    return [...new Set([q, ...extra].join(" ").toLowerCase().split(/[^\p{L}\p{N}-]+/u).filter((x) => x.length > 2 && !stop.has(x)))]
      .sort((a, b) => b.length - a.length).slice(0, 30);
  }

  /* ======================= state & routing ======================= */
  const S = { cases: [], stats: null, showcase: null, examples: null, entityCache: new Map(),
    ex: { sources: null, types: new Set(["person", "unit", "project", "infrastructure"]), data: null, ctl: null },
    ctx: store.get("nav-ctx", null) };
  const view = () => $("#view");
  const spinner = () => `<div class="working"><span class="spinner"></span></div>`;

  async function refreshCases() {
    try { S.cases = await api("/cases"); } catch { S.cases = []; }
    const open = S.cases.filter((c) => ["new", "changes_requested", "in_review", "approved"].includes(c.status)).length;
    const rev = S.cases.filter((c) => c.status === "in_review").length;
    $("#cntOpen").textContent = open || ""; $("#cntReview").textContent = rev || "";
  }

  function route() {
    const h = location.hash.replace(/^#/, "") || "/";
    const [path, qs] = h.split("?");
    const parts = path.split("/").filter(Boolean);
    const nav = parts[0] === "review" ? "review" : parts[0] === "explore" ? "explore" : "requests";
    $$(".tabs a").forEach((a) => { a.classList.toggle("on", a.dataset.nav === nav); a.toggleAttribute("aria-current", a.dataset.nav === nav); });
    document.body.classList.remove("sheet-open");
    window.scrollTo(0, 0);
    if (parts[0] === "new") return viewNew();
    if (parts[0] === "case" && parts[1]) return viewCase(parts[1]);
    if (parts[0] === "review") return viewReview();
    if (parts[0] === "explore") return viewExplore(new URLSearchParams(qs || ""));
    return viewRequests();
  }

  /* ======================= view: requests board ======================= */
  async function viewRequests() {
    view().innerHTML = spinner();
    await refreshCases();
    const by = (sts) => S.cases.filter((c) => sts.includes(c.status));
    const cols = [["col.todo", ["new", "changes_requested"]], ["col.review", ["in_review"]], ["col.ready", ["approved"]], ["col.done", ["contacted", "call_scheduled", "closed"]]];
    const card = (c) => `<a class="case-card" href="#/case/${esc(c.id)}">
        <h3>${esc(c.company)}</h3><p>${esc(c.summary)}</p>
        <div class="case-meta">${pill(c.status)}${c.selected ? `<span>${c.selected} ${esc(t("partners"))}</span>` : ""}
          ${c.country ? `<span>${esc(c.country)}</span>` : ""}<span>${esc(fmtDate(c.updated_at, false))}</span></div></a>`;
    const kpi = (v, l) => `<div class="kpi"><div class="v">${v}</div><div class="l">${esc(t(l))}</div></div>`;
    view().innerHTML = `
      <section class="hero-band">
        <div><h1>${esc(t("req.title"))}</h1><p>${esc(t("req.lead"))}</p>
          <div class="actions"><a class="btn-primary btn-brand" href="#/new">${ICON.plus}${esc(t("req.new"))}</a>
          <a class="btn" href="#/explore">${esc(t("req.explore"))}</a></div></div>
        <div class="flow">${[1, 2, 3, 4].map((n) => `<div><span class="n">${n}</span><b>${esc(t("flow." + n))}</b>${esc(t("flow." + n + "d"))}</div>`).join("")}</div>
      </section>
      <div class="kpis">
        ${kpi(by(["new", "changes_requested", "in_review", "approved"]).length, "kpi.open")}${kpi(by(["in_review"]).length, "kpi.review")}
        ${kpi(by(["approved"]).length, "kpi.ready")}${kpi(by(["contacted", "call_scheduled"]).length, "kpi.invited")}
      </div>
      ${S.cases.length ? `<div class="board">${cols.map(([l, sts]) => {
        const xs = by(sts);
        return `<section class="col" aria-label="${esc(t(l))}"><div class="col-h"><span>${esc(t(l))}</span><i class="count">${xs.length || ""}</i></div>
          ${xs.map(card).join("") || `<div class="col-empty">${esc(t("col.empty"))}</div>`}</section>`;
      }).join("")}</div>`
      : `<div class="panel empty"><div class="empty-ico">${ICON.inbox}</div><h3>${esc(t("board.emptyTitle"))}</h3><p>${esc(t("board.emptyText"))}</p>
          <p style="margin-top:14px"><a class="btn-primary btn-brand" href="#/new">${ICON.plus}${esc(t("req.new"))}</a></p></div>`}`;
  }

  /* ======================= view: new request ======================= */
  async function viewNew() {
    if (!S.examples) { try { S.examples = await api("/examples"); } catch { S.examples = []; } }
    view().innerHTML = `
      <a class="back" href="#/">${ICON.back}${esc(t("case.back"))}</a>
      <div class="page-h"><div><h1>${esc(t("new.title"))}</h1><p>${esc(t("new.lead"))}</p></div></div>
      <div class="new-grid">
        <form class="panel" id="newForm">
          <div class="grid-form">
            <label class="field">${esc(t("f.company"))}<input name="company" required maxlength="200"></label>
            <label class="field">${esc(t("f.country"))}<input name="country" maxlength="100"></label>
            <label class="field">${esc(t("f.contact"))}<input name="contact_name" maxlength="200"></label>
            <label class="field">${esc(t("f.email"))}<input name="contact_email" type="email" maxlength="200"></label>
            <label class="field full">${esc(t("f.request"))} <small>${esc(t("f.requestHint"))}</small>
              <textarea name="request_text" required minlength="10" maxlength="12000" rows="9"></textarea></label>
          </div>
          <div class="sel-bar"><span class="muted">${ICON.shield} ${esc(t("foot.data"))}</span>
            <button class="btn-primary btn-brand" type="submit">${ICON.sparkle}${esc(t("new.submit"))}</button></div>
        </form>
        <aside class="stack">
          <div class="panel"><div class="panel-h"><h2>${esc(t("new.examples"))}</h2></div>
            <div class="examples-list">${(S.examples || []).map((x, i) => `<button type="button" class="ex-btn" data-ex="${i}">
              <b>${esc((x.label && (x.label[LANG] || x.label.en)) || x.company)}</b><span>${esc(x.company)} · ${esc(x.country)}</span></button>`).join("")}</div></div>
          <div class="panel"><div class="panel-h"><h2>${esc(t("new.next"))}</h2></div>
            <ol class="timeline">${["new.next1", "new.next2", "new.next3"].map((k) => `<li>${esc(t(k))}</li>`).join("")}</ol></div>
        </aside>
      </div>`;
    $$("[data-ex]").forEach((b) => b.addEventListener("click", () => {
      const x = S.examples[+b.dataset.ex], f = $("#newForm");
      for (const k of ["company", "country", "contact_name", "contact_email", "request_text"]) f[k].value = x[k] || "";
      f.request_text.focus();
    }));
    $("#newForm").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f = ev.target, body = Object.fromEntries(new FormData(f));
      body.lang = LANG; body.actor = me.name || t("role.officer");
      f.innerHTML = `<div class="working"><span class="spinner"></span><span>${esc(t("new.working"))}</span></div>`;
      try {
        const c = await api("/cases", { method: "POST", body });
        await refreshCases();
        location.hash = `#/case/${c.id}`;
      } catch (e) { toast(`${t("err")}: ${e.message}`); viewNew(); }
    });
  }

  /* ======================= view: case ======================= */
  let CASE = null;
  const stepOf = (st) => ({ new: 2, changes_requested: 2, in_review: 3, approved: 4 }[st] || 5);

  async function viewCase(id) {
    view().innerHTML = spinner();
    await loadGlossary();
    try { CASE = await api(`/cases/${encodeURIComponent(id)}`); }
    catch { view().innerHTML = `<div class="panel empty"><h3>${esc(t("err"))}</h3><p><a href="#/">${esc(t("case.back"))}</a></p></div>`; return; }
    renderCase();
  }

  function renderCase() {
    const c = CASE, step = stepOf(c.status), a = c.analysis;
    const stepCls = (n) => (n < step ? "done" : n === step ? "now" : "");
    view().innerHTML = `
      <a class="back" href="#/">${ICON.back}${esc(t("case.back"))}</a>
      <div class="case-h"><div><h1>${esc(c.company)}</h1>
        <div class="sub">${c.country ? `<span>${esc(c.country)}</span>` : ""}<span>${esc(t("case.received"))} ${esc(fmtDate(c.created_at))}</span></div></div>
        ${pill(c.status)}</div>
      <ol class="stepper">${[1, 2, 3, 4].map((n) => `<li class="${stepCls(n)}"><span class="dotn">${n < step ? "✓" : n}</span>${esc(t("step." + n))}</li>`).join("")}</ol>
      <div class="case-grid">
        <div>${panelUnderstand(a)}${panelPartners(c, step)}${panelReview(c, step)}${panelInvite(c, step)}</div>
        <aside class="side">
          <div class="panel contact-box"><div class="panel-h"><h2>${esc(t("case.contact"))}</h2></div>
            <dl>${c.contact_name ? `<dt>${esc(t("f.contact"))}</dt><dd>${esc(c.contact_name)}</dd>` : ""}
              ${c.contact_email ? `<dt>Email</dt><dd><a href="mailto:${esc(c.contact_email)}">${esc(c.contact_email)}</a></dd>` : ""}
              ${c.country ? `<dt>${esc(t("f.country"))}</dt><dd>${esc(c.country)}</dd>` : ""}</dl></div>
          <div class="panel"><div class="panel-h"><h2>${esc(t("side.activity"))}</h2></div>
            <ol class="timeline">${[...c.events].reverse().map((e) => `<li><b>${esc(e.actor)}</b> · ${esc(e.text)}<time>${esc(fmtDate(e.at))}</time></li>`).join("")}</ol></div>
          <button class="link-btn" id="delCase" type="button">${ICON.trash}${esc(t("side.delete"))}</button>
        </aside>
      </div>`;
    bindCase();
  }

  function panelUnderstand(a) {
    const ai = a.generated_by === "apertus";
    return `<section class="panel done" aria-labelledby="p1h">
      <div class="panel-h"><h2 id="p1h"><span class="num">✓</span>${esc(t("p1.title"))}</h2>
        <span class="ai-badge ${ai ? "" : "rules"}">${ai ? ICON.sparkle : ""}${esc(t(ai ? "p1.ai" : "p1.rules"))}</span></div>
      <p class="plain-summary">${jargon(a.summary)}</p>
      <div class="facts">
        <div class="fact"><h4>${esc(t("p1.does"))}</h4><p>${jargon(a.company_does || "—")}</p></div>
        <div class="fact"><h4>${esc(t("p1.needs"))}</h4>${a.company_needs.length ? `<ul>${a.company_needs.map((n) => `<li>${jargon(n)}</li>`).join("")}</ul>` : "<p>—</p>"}</div>
      </div>
      <div class="words-h">${esc(t("p1.words"))}</div>
      ${a.terms.length ? `<div class="words">${a.terms.map((w) => `<div class="word"><b>${esc(termLabel(w))}
          <span class="src-tag ${w.source === "apertus" ? "ai" : ""}">${esc(t(w.source === "apertus" ? "p1.aiterm" : "p1.glossary"))}</span></b>
          <p>${esc(w.plain)}</p></div>`).join("")}</div>` : `<p class="muted">${esc(t("p1.noterms"))}</p>`}
      <details class="orig"><summary>${esc(t("p1.orig"))}</summary><div class="orig-text">${jargon(CASE.request_text)}</div></details>
    </section>`;
  }

  function termLabel(w) {
    const f = w.found_as || w.term;
    const shown = f.length <= 4 || /^(ce|mdr|fda|iso|ivdr|ai|ip)\b/.test(f) ? f.toUpperCase() : f;
    return shown.toLowerCase() === (w.term || "").toLowerCase() ? shown : `${shown} · ${w.term}`;
  }

  function panelPartners(c, step) {
    const editable = ["new", "changes_requested"].includes(c.status);
    const nSel = c.matches.filter((m) => m.selected).length;
    const rows = c.matches.map((m) => {
      const who = [m.role, m.unit].filter(Boolean).map(esc).join(" · ");
      const verdict = m.review === "ok" ? `<span class="verdict ok">${esc(t("p2.ok"))}</span>`
        : m.review === "no" ? `<span class="verdict no">${esc(t("p2.no"))}</span>` : "";
      return `<div class="match ${m.selected ? "sel" : ""} ${m.review === "no" ? "rej" : ""}">
        <input type="checkbox" data-sel="${esc(m.id)}" ${m.selected ? "checked" : ""} ${editable ? "" : "disabled"} aria-label="${esc(m.name)}">
        ${avatar(m.name, m.entity_type, true)}
        <div><h3>${esc(m.name)}</h3>
          <div class="who">${who ? who + " · " : ""}${esc(m.institution)}</div>
          ${m.plain ? `<p class="plain">${jargon(m.plain.length > 240 ? m.plain.slice(0, 237) + "…" : m.plain)}</p>` : ""}
          <p class="why">${esc(m.why)}${m.review_note ? ` · <b>${esc(m.review_note)}</b>` : ""}</p></div>
        <div class="right"><span class="type-badge ${esc(m.entity_type)}">${esc(t("type." + m.entity_type))}</span>${verdict}
          <a class="link-btn" href="${esc(safeUrl(m.url))}" target="_blank" rel="noopener">${ICON.ext}${esc(t("p2.source"))}</a></div>
      </div>`;
    }).join("");
    return `<section class="panel ${step === 2 ? "active" : step > 2 ? "done" : ""}" aria-labelledby="p2h">
      <div class="panel-h"><h2 id="p2h"><span class="num">${step > 2 ? "✓" : 2}</span>${esc(t("p2.title"))}</h2><span class="muted">${nSel} ${esc(t("p2.selected"))}</span></div>
      ${editable ? `<p class="muted" style="margin:-4px 0 12px">${esc(t("p2.lead"))}</p>
        <form class="match-tools" id="rematch"><input name="q" value="${esc(c.analysis.search_query)}" aria-label="${esc(t("p2.rematch"))}">
          <button class="btn" type="submit">${esc(t("p2.rematch"))}</button>
          <button class="btn" type="button" id="moreExplore">${esc(t("p2.more"))}</button></form>` : ""}
      ${c.matches.length ? `<div class="matches">${rows}</div>` : `<div class="callout warn">${ICON.info}<span>${esc(c.no_match_message || t("p2.none"))}</span></div>`}
    </section>`;
  }

  function panelReview(c, step) {
    const sel = c.matches.filter((m) => m.selected);
    let body;
    if (["new", "changes_requested"].includes(c.status)) {
      body = `${c.status === "changes_requested" ? `<div class="callout warn" style="margin-bottom:12px">${ICON.info}<div><b>${esc(t("p3.changes", { who: c.reviewer }))}</b>${c.review_comment ? `<br>“${esc(c.review_comment)}”` : ""}</div></div>` : ""}
        <p class="muted" style="margin:-4px 0 12px">${esc(t("p3.lead"))}</p>
        <form id="reviewReq" class="grid-form">
          <label class="field">${esc(t("p3.reviewer"))}<input name="reviewer" required maxlength="120" value="${esc(c.reviewer || store.get("nav-lastReviewer", ""))}"></label>
          <label class="field full">${esc(t("p3.note"))}<textarea name="note" rows="2" maxlength="2000" style="min-height:70px"></textarea></label>
          <div class="full actions"><button class="btn-primary" type="submit" ${sel.length ? "" : "disabled"}>${ICON.send}${esc(t("p3.send"))}</button>
            ${sel.length ? "" : `<span class="muted">${esc(t("p3.needSel"))}</span>`}</div>
        </form>`;
    } else if (c.status === "in_review" && me.role !== "reviewer") {
      body = `<div class="callout info">${ICON.info}<div><b>${esc(t("p3.waiting", { who: c.reviewer, n: sel.length }))}</b>${c.review_note ? `<br>“${esc(c.review_note)}”` : ""}</div></div>
        <div class="actions" style="margin-top:10px"><button class="btn btn-sm" id="asReviewer" type="button">${esc(t("p3.switch"))}</button></div>`;
    } else if (c.status === "in_review") {
      body = `<p class="muted" style="margin:-4px 0 12px">${esc(t("p3.rv.lead"))}</p>
        ${c.review_note ? `<div class="callout" style="margin-bottom:12px">${ICON.info}<span>“${esc(c.review_note)}”</span></div>` : ""}
        <div id="rvItems">${sel.map((m) => `<div class="review-item" data-rv="${esc(m.id)}">
          <div class="review-row"><div style="display:flex;gap:10px;align-items:center;min-width:0">${avatar(m.name, m.entity_type, true)}<div><b>${esc(m.name)}</b>
            <div class="muted">${[m.role, m.unit, m.institution].filter(Boolean).map(esc).join(" · ")}</div></div></div>
            <div class="seg" role="group" aria-label="${esc(m.name)}"><button type="button" data-v="ok">${esc(t("p3.rv.ok"))}</button><button type="button" data-v="no">${esc(t("p3.rv.no"))}</button></div></div>
          <p class="muted" style="margin:8px 0 6px">${esc(m.why)}</p>
          <div class="actions"><input class="rv-note" placeholder="${esc(t("p3.rv.note"))}" style="flex:1;min-width:180px" aria-label="${esc(t("p3.rv.note"))}">
            <button class="btn btn-sm" type="button" data-details="${esc(m.id)}">${esc(t("p3.rv.details"))}</button></div>
          <div class="rv-details"></div></div>`).join("")}</div>
        <label class="field" style="margin-top:12px">${esc(t("p3.rv.comment"))}<textarea id="rvComment" rows="2" style="min-height:70px"></textarea></label>
        <div class="actions" style="margin-top:12px"><button class="btn-primary btn-ok" id="rvApprove" type="button" disabled>${ICON.check}${esc(t("p3.rv.approve"))}</button>
          <button class="btn" id="rvChanges" type="button">${esc(t("p3.rv.changes"))}</button></div>`;
    } else {
      const ok = c.matches.filter((m) => m.selected && m.review === "ok").length;
      body = `<div class="callout ok">${ICON.check}<div><b>${esc(t("p3.approved", { who: c.reviewer, n: ok }))}</b>${c.review_comment ? `<br>“${esc(c.review_comment)}”` : ""}</div></div>`;
    }
    return `<section class="panel ${step === 3 ? "active" : step > 3 ? "done" : ""}" aria-labelledby="p3h">
      <div class="panel-h"><h2 id="p3h"><span class="num">${step > 3 ? "✓" : 3}</span>${esc(t("p3.title"))}</h2>
        ${c.reviewer ? `<span class="muted">${esc(c.reviewer)}</span>` : ""}</div>${body}</section>`;
  }

  function nextSlots() {
    const out = [], d = new Date(), pad = (n) => String(n).padStart(2, "0");
    while (out.length < 3) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${out.length % 2 ? "14" : "10"}:00`);
    }
    return out;
  }

  function panelInvite(c, step) {
    if (step < 4) {
      return `<section class="panel locked" aria-labelledby="p4h"><div class="panel-h"><h2 id="p4h"><span class="num">4</span>${esc(t("p4.title"))}</h2></div>
        <p class="muted" style="margin:0">${esc(t("p4.locked"))}</p></section>`;
    }
    const done = ["contacted", "call_scheduled", "closed"].includes(c.status);
    return `<section class="panel ${done ? "done" : "active"}" aria-labelledby="p4h">
      <div class="panel-h"><h2 id="p4h"><span class="num">${done ? "✓" : 4}</span>${esc(t("p4.title"))}</h2></div>
      ${c.outreach?.sent_at ? `<div class="callout ok" style="margin-bottom:12px">${ICON.check}<span>${esc(t("p4.doneEmail", { d: fmtDate(c.outreach.sent_at) }))}</span></div>` : ""}
      ${c.outreach?.call ? `<div class="callout ok" style="margin-bottom:12px">${ICON.cal}<span>${esc(t("p4.doneCall", { d: c.outreach.call }))}</span></div>` : ""}
      <div class="grid-form">
        <label class="field">${esc(t("p4.lang"))}<select class="input" id="mailLang">${["en", "de", "fr"].map((l) => `<option value="${l}" ${l === LANG ? "selected" : ""}>${l.toUpperCase()}</option>`).join("")}</select></label>
        <label class="field">${esc(t("p4.duration"))}<select class="input" id="callMin"><option>30</option><option>45</option><option>60</option></select></label>
        <div class="field full">${esc(t("p4.slots"))}<div class="slots">${nextSlots().map((s) => `<input type="datetime-local" class="slot" value="${s}" aria-label="${esc(t("p4.slots"))}">`).join("")}</div></div>
      </div>
      <div class="actions" style="margin-top:12px"><button class="btn-primary btn-brand" id="prepMail" type="button">${ICON.mail}${esc(t("p4.prepare"))}</button>
        <button class="btn" id="dlIcs" type="button">${ICON.cal}${esc(t("p4.ics"))}</button></div>
      <div id="mailBox"></div>
    </section>`;
  }

  const slotLabels = () => $$(".slot").map((i) => i.value).filter(Boolean).map((v) => fmtDate(v));

  function bindCase() {
    const c = CASE;
    $("#delCase")?.addEventListener("click", async () => {
      if (!confirm(t("side.confirmDelete"))) return;
      await api(`/cases/${c.id}`, { method: "DELETE" }); await refreshCases(); location.hash = "#/";
    });
    let selTimer;
    $$("[data-sel]").forEach((cb) => cb.addEventListener("change", () => {
      const m = c.matches.find((x) => x.id === cb.dataset.sel); m.selected = cb.checked;
      cb.closest(".match").classList.toggle("sel", cb.checked);
      clearTimeout(selTimer);
      selTimer = setTimeout(async () => {
        CASE = await api(`/cases/${c.id}/selection`, { method: "POST", body: { selected: c.matches.filter((x) => x.selected).map((x) => x.id), actor: me.name } });
        const y = window.scrollY; renderCase(); window.scrollTo(0, y);
      }, 250);
    }));
    $("#rematch")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const q = ev.target.q.value.trim(); if (q.length < 2) return;
      ev.target.querySelector("button").disabled = true;
      CASE = await api(`/cases/${c.id}/rematch`, { method: "POST", body: { query: q, actor: me.name } });
      renderCase();
    });
    $("#moreExplore")?.addEventListener("click", () => {
      S.ctx = { id: c.id, company: c.company }; store.set("nav-ctx", S.ctx);
      location.hash = `#/explore?q=${encodeURIComponent(c.analysis.search_query)}`;
    });
    $("#reviewReq")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f = ev.target; store.set("nav-lastReviewer", f.reviewer.value);
      try {
        CASE = await api(`/cases/${c.id}/review-request`, { method: "POST", body: { reviewer: f.reviewer.value, note: f.note.value, actor: me.name || t("role.officer") } });
        await refreshCases(); renderCase(); toast(t("st.in_review"));
      } catch (e) { toast(e.message); }
    });
    $("#asReviewer")?.addEventListener("click", () => { S.demoReviewer = true; setRole("reviewer"); renderCase(); });
    const verdicts = {};
    $$("[data-rv]").forEach((it) => {
      $$(".seg button", it).forEach((b) => b.addEventListener("click", () => {
        verdicts[it.dataset.rv] = b.dataset.v;
        $$(".seg button", it).forEach((x) => x.classList.remove("on-ok", "on-no"));
        b.classList.add(b.dataset.v === "ok" ? "on-ok" : "on-no");
        $("#rvApprove").disabled = !Object.values(verdicts).includes("ok");
      }));
    });
    $$("[data-details]").forEach((b) => b.addEventListener("click", async () => {
      const box = $(".rv-details", b.closest(".review-item"));
      if (box.innerHTML) { box.innerHTML = ""; return; }
      const d = await entity(b.dataset.details);
      box.innerHTML = `<ul class="evidence">${d.entity.evidence.slice(0, 12).map((ev) =>
        `<li><span class="f">${esc(ev.field)}</span>“${esc(ev.snippet)}” <a href="${esc(safeUrl(ev.url))}" target="_blank" rel="noopener">${esc(hostPath(ev.url))}</a></li>`).join("")}</ul>`;
    }));
    const submitReview = async (decision) => {
      // In the single-browser demo the officer "plays" the assigned reviewer: attribute it to that person
      const actor = S.demoReviewer || !me.name ? (c.reviewer || t("role.reviewer")) : me.name;
      const body = { decision, comment: $("#rvComment").value, actor,
        verdicts: $$("[data-rv]").filter((it) => verdicts[it.dataset.rv]).map((it) => ({ id: it.dataset.rv, verdict: verdicts[it.dataset.rv], note: $(".rv-note", it).value })) };
      try {
        CASE = await api(`/cases/${c.id}/review`, { method: "POST", body });
        if (S.demoReviewer) { S.demoReviewer = false; setRole("officer"); }
        await refreshCases(); renderCase(); toast(t("st." + decision));
      }
      catch (e) { toast(e.message); }
    };
    $("#rvApprove")?.addEventListener("click", () => submitReview("approved"));
    $("#rvChanges")?.addEventListener("click", () => submitReview("changes_requested"));
    $("#prepMail")?.addEventListener("click", async () => {
      const d = await api(`/cases/${c.id}/draft`, { method: "POST", body: { lang: $("#mailLang").value, slots: slotLabels(), sender: me.name, team: me.team } });
      $("#mailBox").innerHTML = `<div class="email-box">
        <label class="field">${esc(t("p4.subject"))}<input id="mSubj" value="${esc(d.subject)}"></label>
        <label class="field">${esc(t("p4.body"))}<textarea id="mBody">${esc(d.body)}</textarea></label>
        <div class="actions"><a class="btn-primary" id="mOpen" href="#">${ICON.mail}${esc(t("p4.open"))}</a>
          <button class="btn" id="mCopy" type="button">${ICON.copy}${esc(t("p4.copy"))}</button>
          <button class="btn" id="mSent" type="button">${ICON.check}${esc(t("p4.sent"))}</button></div></div>`;
      $("#mOpen").addEventListener("click", (ev) => {
        ev.preventDefault();
        location.href = `mailto:${encodeURIComponent(c.contact_email || "")}?subject=${encodeURIComponent($("#mSubj").value)}&body=${encodeURIComponent($("#mBody").value)}`;
      });
      $("#mCopy").addEventListener("click", () => { navigator.clipboard?.writeText(`${$("#mSubj").value}\n\n${$("#mBody").value}`); toast("✓"); });
      $("#mSent").addEventListener("click", async () => {
        CASE = await api(`/cases/${c.id}/outcome`, { method: "POST", body: { kind: "email", subject: $("#mSubj").value, body: $("#mBody").value, actor: me.name } });
        await refreshCases(); renderCase(); toast(t("st.contacted"));
      });
      $("#mBody").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    $("#dlIcs")?.addEventListener("click", async () => {
      const start = $$(".slot")[0]?.value; if (!start) return;
      const p = new URLSearchParams({ start, minutes: $("#callMin").value, organizer: me.name || "", organizer_email: me.email || "" });
      const a = document.createElement("a"); a.href = `/cases/${c.id}/invite.ics?${p}`; a.download = ""; a.click();
      CASE = await api(`/cases/${c.id}/outcome`, { method: "POST", body: { kind: "call", detail: fmtDate(start), actor: me.name } });
      await refreshCases(); renderCase(); toast(t("st.call_scheduled"));
    });
  }

  /* ======================= view: review queue ======================= */
  async function viewReview() {
    view().innerHTML = spinner();
    await refreshCases();
    const xs = S.cases.filter((c) => c.status === "in_review");
    const mine = (c) => !!(me.name && c.reviewer && c.reviewer.toLowerCase().includes(me.name.toLowerCase()));
    view().innerHTML = `<div class="page-h"><div><h1>${esc(t("rv.title"))}</h1><p>${esc(t("rv.lead"))}</p></div></div>
      ${xs.length ? `<div class="dir">${xs.sort((a, b) => mine(b) - mine(a)).map((c) => `<a class="case-card" href="#/case/${esc(c.id)}">
          <h3>${esc(c.company)}</h3><p>${esc(c.summary)}</p>
          <div class="case-meta">${pill(c.status)}<span>${c.selected} ${esc(t("partners"))}</span><span>${esc(c.reviewer)}</span>
          ${mine(c) ? `<b style="color:var(--brand)">${esc(t("rv.mine"))}</b>` : ""}</div></a>`).join("")}</div>`
      : `<div class="panel empty"><div class="empty-ico">${ICON.check}</div><h3>${esc(t("rv.empty"))}</h3></div>`}`;
    if (me.role !== "reviewer" && xs.length) setRole("reviewer");
  }

  /* ======================= view: explore ======================= */
  async function entity(id) {
    if (!S.entityCache.has(id)) S.entityCache.set(id, await api(`/entity/${encodeURIComponent(id)}`));
    return S.entityCache.get(id);
  }

  async function viewExplore(params) {
    await loadGlossary();
    if (!S.stats) { try { S.stats = await api("/stats"); } catch {} }
    if (!S.ex.sources && S.stats) S.ex.sources = new Set(S.stats.sources.map((x) => x.name));
    const q = params.get("q") || "";
    const ctx = S.ctx;
    const st = S.stats || { sources: [], entities_per_source: {} };
    view().innerHTML = `
      ${ctx ? `<div class="ctx-banner"><span>${ICON.info} ${esc(t("ex.ctx", { c: ctx.company }))}</span>
        <span class="actions"><a class="btn btn-sm" href="#/case/${esc(ctx.id)}">${esc(t("ex.ctxBack"))}</a>
        <button class="link-btn" id="ctxClose" type="button" aria-label="Close">✕</button></span></div>` : ""}
      <section class="hero" ${q ? 'style="padding-top:4px"' : ""}>
        ${q ? "" : `<h1>${t("ex.title")}</h1><p>${esc(t("ex.lead"))}</p>`}
        <form class="searchbox" id="exForm" role="search">${ICON.search}
          <input id="exQ" type="search" value="${esc(q)}" placeholder="${esc(t("ex.ph"))}" aria-label="${esc(t("ex.search"))}" autocomplete="off">
          <button class="btn-primary" type="submit">${esc(t("ex.search"))}</button></form>
        ${q ? "" : `<div class="chips">${["glucose sensors", "kontinuierliche Glukosemessung", "robots for neurosurgery", "3D printing facility", "organs-on-chip"].map((x) => `<button class="chip" type="button" data-q="${esc(x)}">${esc(x)}</button>`).join("")}
          <button class="chip ghost" type="button" data-q="best pizza delivery in Bern">${esc(t("ex.abstainChip"))}</button></div>`}
      </section>
      <div class="filters">
        <div class="fgroup">${st.sources.filter((x) => (st.entities_per_source[x.name] ?? 0) > 0).map((x) => `<button type="button" class="fchip ${S.ex.sources?.has(x.name) ? "on" : ""}" data-src="${esc(x.name)}" title="${esc(x.label)}">
          <i class="t-dot src"></i>${esc(x.name === "unibe" ? "UniBE" : x.name.toUpperCase())} <span class="muted">${st.entities_per_source[x.name] ?? 0}</span></button>`).join("")}</div>
        <div class="fgroup">${[["person", "f.people"], ["unit", "f.labs"], ["project", "f.projects"], ["infrastructure", "f.facilities"]].map(([k, l]) =>
          `<button type="button" class="fchip ${S.ex.types.has(k) ? "on" : ""}" data-type="${k}"><i class="t-dot ${k}"></i>${esc(t(l))}</button>`).join("")}</div>
      </div>
      <div id="exBody"></div>`;
    $("#ctxClose")?.addEventListener("click", () => { S.ctx = null; store.set("nav-ctx", null); viewExplore(params); });
    $("#exForm").addEventListener("submit", (ev) => { ev.preventDefault(); const v = $("#exQ").value.trim(); if (v.length > 1) location.hash = `#/explore?q=${encodeURIComponent(v)}`; });
    $$(".chip[data-q]").forEach((b) => b.addEventListener("click", () => { location.hash = `#/explore?q=${encodeURIComponent(b.dataset.q)}`; }));
    $$(".fchip").forEach((f) => f.addEventListener("click", () => {
      const set = f.dataset.src ? S.ex.sources : S.ex.types, key = f.dataset.src || f.dataset.type;
      if (set.has(key) && set.size === 1) return;
      set.has(key) ? set.delete(key) : set.add(key);
      f.classList.toggle("on");
      if (q) runExplore(q);
    }));
    if (q) runExplore(q); else renderShowcase();
  }

  async function renderShowcase() {
    const body = $("#exBody");
    body.innerHTML = spinner();
    if (!S.showcase) { try { S.showcase = await api("/showcase"); } catch { body.innerHTML = ""; return; } }
    const sc = S.showcase, L = (o) => (o && (o[LANG] || o.en)) || "";
    const go = (q) => `#/explore?q=${encodeURIComponent(q)}`;
    body.innerHTML = `
      ${sc.highlights.length ? `<div class="section-h"><h2>${esc(t("ex.proof"))}</h2><span class="muted">${esc(t("ex.proofNote"))}</span></div>
      <div class="proof">${sc.highlights.map((h) => `<article class="proof-card"><div class="fig">${esc(h.figure)}</div><div class="lbl">${esc(L(h.label))}</div>
        <q>${esc(h.quote)}</q><a href="${esc(safeUrl(h.url))}" target="_blank" rel="noopener">${ICON.link} ${esc(hostPath(h.url))}</a></article>`).join("")}</div>` : ""}
      <div class="section-h"><h2>${esc(t("ex.themes"))}</h2><span class="muted">${esc(t("ex.themesNote"))}</span></div>
      <div class="themes">${sc.themes.map((th) => `<a class="theme" href="${go(th.query)}" style="text-decoration:none">
        <h3>${esc(L(th.title))}</h3><p>${esc(L(th.blurb))}</p>
        <div class="nums"><span><b>${th.counts.person}</b> ${esc(t("ex.people"))}</span><span><b>${th.counts.unit}</b> ${esc(t("ex.labsN"))}</span>
          <span><b>${th.counts.project}</b> ${esc(t("ex.projects"))}</span></div>
        ${th.labs.length ? `<div class="labs">${th.labs.map((l) => esc(l.name)).join(" · ")}</div>` : ""}</a>`).join("")}</div>
      <div class="section-h"><h2>${esc(t("ex.fac"))}</h2><span class="muted">${sc.facilities.length}</span></div>
      <div class="dir">${sc.facilities.map(dirCard).join("")}</div>
      <div class="section-h"><h2>${esc(t("ex.labs"))}</h2><span class="muted">${sc.labs.length}</span></div>
      <div class="dir">${sc.labs.map(dirCard).join("")}</div>
      ${sc.engage.length ? `<div class="section-h"><h2>${esc(t("ex.engage"))}</h2></div>
      <div class="engage">${sc.engage.map((e) => `<article class="engage-card"><b>${esc(L(e.title))}</b><q>${esc(e.quote)}</q>
        <a href="${esc(safeUrl(e.url))}" target="_blank" rel="noopener">${ICON.link} ${esc(hostPath(e.url))}</a></article>`).join("")}</div>` : ""}`;
    $$("[data-open]", body).forEach((b) => b.addEventListener("click", () => { location.hash = go(b.dataset.open); }));
  }

  function dirCard(f) {
    const meta = [f.lead ? `${t("ex.lead_")}: ${f.lead.name}` : "", f.people ? `${f.people} ${t("ex.people")}` : "", f.institution].filter(Boolean);
    return `<button type="button" class="dir-card" data-open="${esc(f.name)}">${avatar(f.name, f.entity_type, true)}
      <div><h3>${esc(f.name)}</h3><div class="lead">${esc(meta.join(" · "))}</div>${f.summary ? `<p>${jargon(f.summary)}</p>` : ""}</div></button>`;
  }

  async function runExplore(q) {
    const body = $("#exBody");
    body.innerHTML = `<div class="results-view"><div class="results-col"><div class="results-head" id="rHead"><span class="cnt">…</span></div>
      <div class="results" id="rList">${Array.from({ length: 3 }, () => `<div class="skel"><div class="sk" style="width:40%;height:16px"></div><div class="sk" style="width:70%"></div><div class="sk"></div></div>`).join("")}</div></div>
      <aside class="detail" id="detail" aria-label="Details"><div class="detail-empty"><p>${esc(t("ex.select"))}</p></div></aside></div>`;
    const p = new URLSearchParams({ q, k: "12" });
    if (S.stats && S.ex.sources && S.ex.sources.size < S.stats.sources.length) S.ex.sources.forEach((s) => p.append("source", s));
    if (S.ex.types.size < 4) S.ex.types.forEach((x) => p.append("type", x));
    S.ex.ctl?.abort(); S.ex.ctl = new AbortController();
    try { S.ex.data = await api(`/search?${p}`, { signal: S.ex.ctl.signal }); }
    catch (e) { if (e.name !== "AbortError") body.innerHTML = `<div class="abstain"><h3>${esc(t("err"))}</h3><p>${esc(e.message)}</p></div>`; return; }
    renderResults();
  }

  function renderResults() {
    const d = S.ex.data, terms = termsFor(d.query, d.expanded_terms);
    $(".results-view").classList.toggle("solo", !!d.abstained);
    $("#rHead").innerHTML = d.abstained ? "" : `<span class="cnt">${d.results.length} ${esc(t("ex.results"))}</span><span>${(d.took_ms / 1000).toFixed(2)} s</span>
      ${d.expanded_terms.length ? `<span>${esc(t("ex.also"))}</span>${d.expanded_terms.slice(0, 7).map((x) => `<span class="term">${esc(x)}</span>`).join("")}` : ""}`;
    if (d.abstained) {
      $("#rList").innerHTML = `<div class="abstain"><div class="empty-ico" style="color:var(--warn);background:var(--warn-bg)">${ICON.shield}</div>
        <h3>${esc(t("ex.none"))}</h3><p>${esc(d.message)}</p><p class="muted" style="margin-top:10px">${esc(t("ex.noneHint"))}</p></div>`;
      return;
    }
    const hit = (s) => terms.reduce((n, w) => n + (s.toLowerCase().includes(w) ? 1 : 0), 0);
    $("#rList").innerHTML = d.results.map((r, i) => {
      const q0 = [...r.sources].sort((a, b) => hit(b.snippet) - hit(a.snippet) || (a.field === "name") - (b.field === "name"))[0];
      const sub = [r.role, r.affiliation.unit, r.affiliation.institute].filter(Boolean).map(esc).join(" · ");
      return `<article class="card" tabindex="0" data-i="${i}">
        <div class="card-top">${avatar(r.person_or_unit, r.entity_type)}
          <div><h3>${esc(r.person_or_unit)}</h3>${sub ? `<div class="sub2">${sub}</div>` : ""}<div class="inst">${esc(r.institution)}</div></div>
          <span class="type-badge ${esc(r.entity_type)}">${esc(t("type." + r.entity_type))}</span></div>
        ${r.via ? `<div class="via">${esc(t("ex.found"))} <b>${esc(r.via)}</b></div>` : ""}
        ${r.description ? `<p class="why">${jargon(r.description.length > 220 ? r.description.slice(0, 217) + "…" : r.description)}</p>` : ""}
        <p class="why"><b>${esc(t("ex.why"))}:</b> ${highlight(r.why_match, terms)}</p>
        ${q0 ? `<div class="quote">“${highlight(q0.snippet.length > 240 ? q0.snippet.slice(0, 237) + "…" : q0.snippet, terms)}”
          <div class="src">${ICON.link}<a href="${esc(safeUrl(q0.url))}" target="_blank" rel="noopener">${esc(hostPath(q0.url))}</a></div></div>` : ""}
        <div class="card-foot"><span class="verified">${ICON.check}${esc(t("ex.verified"))}</span><span>${r.sources.length} ${esc(t("ex.cites"))}</span>
          ${r.contact ? `<span>${esc(r.contact)}</span>` : ""}</div></article>`;
    }).join("");
    $$(".card", $("#rList")).forEach((c) => {
      c.addEventListener("click", (ev) => { if (!ev.target.closest("a")) selectResult(+c.dataset.i); });
      c.addEventListener("keydown", (ev) => { if (ev.key === "Enter") selectResult(+c.dataset.i); });
    });
    if (!isNarrow() && d.results.length) selectResult(0, false);
  }

  function selectResult(i, open = true) {
    $$(".card").forEach((c, j) => c.classList.toggle("sel", j === i));
    showDetail(S.ex.data.results[i].id, S.ex.data.results[i], open);
  }

  async function showDetail(id, result, open = true) {
    const panel = $("#detail");
    if (!panel) return;
    if (isNarrow() && open) { panel.classList.add("open"); document.body.classList.add("sheet-open"); }
    panel.innerHTML = `<div class="d-head"><div class="sk" style="width:60%;height:18px"></div></div>`;
    let det; try { det = await entity(id); } catch { panel.innerHTML = `<div class="detail-empty">${esc(t("err"))}</div>`; return; }
    const e = det.entity, terms = S.ex.data ? termsFor(S.ex.data.query, S.ex.data.expanded_terms) : [];
    const byUrl = new Map();
    e.evidence.forEach((ev) => { if (!byUrl.has(ev.url)) byUrl.set(ev.url, []); byUrl.get(ev.url).push(ev); });
    const ctx = S.ctx;
    panel.innerHTML = `
      <div class="d-head"><div class="row">${avatar(e.name, e.entity_type)}
        <div><h2>${esc(e.name)}</h2>${e.role ? `<div class="sub2">${esc(e.role)}</div>` : ""}
          <div class="crumbs">${[e.source_label, e.institute, e.unit].filter(Boolean).map(esc).join(" › ")}</div></div>
        <button class="icon-btn close-btn" id="dClose" type="button" aria-label="Close">${ICON.close}</button></div>
        <div class="d-actions">
          ${ctx ? `<button class="btn-primary btn-brand btn-sm" id="addCtx" type="button">${ICON.plus}${esc(t("ex.add"))}</button>` : ""}
          ${e.email ? `<a class="btn btn-sm" href="mailto:${esc(e.email)}">${ICON.mail}${esc(e.email)}</a>` : ""}
          <a class="btn btn-sm" href="${esc(safeUrl(e.source_urls[0]))}" target="_blank" rel="noopener">${ICON.ext}${esc(t("ex.open"))}</a></div></div>
      <div class="d-body">
        ${result ? `<section class="d-sec"><h4>${esc(t("ex.why"))}</h4><p>${highlight(result.why_match, terms)}</p></section>` : ""}
        ${e.description?.length ? `<section class="d-sec"><h4>${esc(t("ex.about"))}</h4><p>${jargon(e.description[0])}</p></section>` : ""}
        ${e.expertise.length ? `<section class="d-sec"><h4>${esc(t("ex.expertise"))}</h4><div class="tags">${e.expertise.slice(0, 12).map((x) => `<span class="tag" title="${esc(x)}">${jargon(x)}</span>`).join("")}</div></section>` : ""}
        ${det.related.length ? `<section class="d-sec"><h4>${esc(t("ex.linked"))}</h4><div class="rel">${det.related.map((x) => `<button type="button" data-id="${esc(x.id)}">
          <span class="mini ${esc(x.entity_type)}">${esc(x.entity_type === "person" ? initialsOf(x.name) : x.entity_type[0].toUpperCase())}</span>
          <span>${esc(x.name)}</span>${x.role ? `<span class="r-role">· ${esc(x.role.slice(0, 28))}</span>` : ""}</button>`).join("")}</div></section>` : ""}
        <section class="d-sec"><h4>${esc(t("ex.evidence"))} · ${e.evidence.length}</h4>
          ${[...byUrl.entries()].map(([u, evs]) => `<div class="ev-page"><a class="ev-url" href="${esc(safeUrl(u))}" target="_blank" rel="noopener">${ICON.ext}<span>${esc(hostPath(u))}</span></a>
            <ul class="ev-list">${evs.map((ev) => `<li><span class="ev-field">${esc(ev.field)}</span><span>“${highlight(ev.snippet, terms)}”</span></li>`).join("")}</ul></div>`).join("")}</section>
      </div>`;
    $("#dClose")?.addEventListener("click", () => { panel.classList.remove("open"); document.body.classList.remove("sheet-open"); });
    $$(".rel button", panel).forEach((b) => b.addEventListener("click", () => showDetail(b.dataset.id, null)));
    $("#addCtx")?.addEventListener("click", async () => {
      try { await api(`/cases/${ctx.id}/matches`, { method: "POST", body: { entity_id: e.id, actor: me.name } }); toast(`${t("ex.added")}: ${e.name}`); }
      catch (err) { toast(err.message); }
    });
  }

  /* ======================= boot ======================= */
  async function status() {
    try {
      const h = await api("/health"), el = $("#status"), m = (h.model || "Apertus").split("/").pop();
      el.classList.toggle("on", h.llm_available); el.classList.toggle("off", !h.llm_available);
      $(".status-label", el).textContent = t(h.llm_available ? "llm.on" : "llm.off", { m });
      el.title = t(h.llm_available ? "llm.onT" : "llm.offT");
    } catch {}
  }

  function boot() {
    let theme = store.get("nav-theme", null);
    if (theme) document.documentElement.dataset.theme = theme;
    $("#themeBtn").addEventListener("click", () => {
      const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      theme = cur === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = theme; store.set("nav-theme", theme);
    });
    $("#lang").addEventListener("change", (ev) => { LANG = ev.target.value; store.set("nav-lang", LANG); applyStaticI18n(); renderMe(); status(); route(); });
    $("#meBtn").addEventListener("click", openMe);
    $("#meDlg").addEventListener("close", () => {
      if ($("#meDlg").returnValue !== "ok") return;
      const f = $("#meForm");
      me = { name: f.name.value.trim(), email: f.email.value.trim(), team: f.team.value.trim(), role: f.role.value || "officer" };
      store.set("nav-me", me); renderMe(); route(); toast(t("saved"));
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && document.body.classList.contains("sheet-open")) { $("#detail")?.classList.remove("open"); document.body.classList.remove("sheet-open"); }
      if (ev.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) && $("#exQ")) { ev.preventDefault(); $("#exQ").focus(); }
    });
    document.addEventListener("click", (ev) => {
      if (document.body.classList.contains("sheet-open") && !ev.target.closest("#detail") && !ev.target.closest(".card")) {
        $("#detail")?.classList.remove("open"); document.body.classList.remove("sheet-open");
      }
    });
    window.addEventListener("hashchange", route);
    applyStaticI18n(); renderMe(); status(); refreshCases(); route();
    if (!me.name) setTimeout(openMe, 400);
    setInterval(status, 60000);
  }
  boot();
})();
