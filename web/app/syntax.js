// ETCBC BHSA labels (from the BHSA feature documentation) and colour groups.

export const FUNCTION = {
  Adju: "Adjunct", Cmpl: "Complement", Conj: "Conjunction", EPPr: "Enclitic personal pronoun",
  ExsS: "Existence with subject suffix", Exst: "Existence", Frnt: "Fronted element", Intj: "Interjection",
  IntS: "Interjection with subject suffix", Loca: "Locative", Modi: "Modifier", ModS: "Modifier with subject suffix",
  NCop: "Negative copula", NCoS: "Negative copula with subject suffix", Nega: "Negation", Objc: "Object",
  PrAd: "Predicative adjunct", PrcS: "Predicate complement with subject suffix", PreC: "Predicate complement",
  Pred: "Predicate", PreO: "Predicate with object suffix", PreS: "Predicate with subject suffix",
  PtcO: "Participle with object suffix", Ques: "Question", Rela: "Relative", Subj: "Subject",
  Supp: "Supplementary constituent", Time: "Time reference", Unkn: "Unknown", Voct: "Vocative",
};

// Short labels shown under words.
export const FUNCTION_SHORT = {
  Pred: "Pred", PreO: "Pred+obj", PreS: "Pred+subj", PtcO: "Ptc+obj", Subj: "Subj", Objc: "Obj",
  Cmpl: "Compl", Adju: "Adjunct", Time: "Time", Loca: "Place", PreC: "Pred.compl", PrcS: "Pred.compl",
  Voct: "Vocative", Frnt: "Fronted", Conj: "Conj", Rela: "Rel", Nega: "Neg", Ques: "Ques", Intj: "Interj",
  Modi: "Mod", ModS: "Mod", PrAd: "Pred.adj", Exst: "Exist", ExsS: "Exist", NCop: "Neg.cop", NCoS: "Neg.cop",
  Supp: "Suppl", EPPr: "Pron", IntS: "Interj", Unkn: "?",
};

// Colour families.
export const FUNCTION_GROUP = {
  Pred: "pred", PreO: "pred", PreS: "pred", PtcO: "pred", Exst: "pred", ExsS: "pred", NCop: "pred", NCoS: "pred",
  Subj: "subj", Objc: "objc", Cmpl: "cmpl", Adju: "cmpl", Time: "cmpl", Loca: "cmpl", PrAd: "cmpl", Supp: "cmpl",
  PreC: "prec", PrcS: "prec", Voct: "voct", Frnt: "frnt",
};

export const PHRASE_TYPE = {
  VP: "Verbal phrase", NP: "Nominal phrase", PrNP: "Proper-noun phrase", AdvP: "Adverbial phrase",
  PP: "Prepositional phrase", CP: "Conjunctive phrase", PPrP: "Personal pronoun phrase",
  DPrP: "Demonstrative pronoun phrase", IPrP: "Interrogative pronoun phrase", InjP: "Interjectional phrase",
  NegP: "Negative phrase", InrP: "Interrogative phrase", AdjP: "Adjective phrase",
};

export const CLAUSE_TYPE = {
  AjCl: "Adjective clause", CPen: "Casus pendens", Defc: "Defective clause atom", Ellp: "Ellipsis",
  InfA: "Infinitive absolute clause", InfC: "Infinitive construct clause", MSyn: "Macrosyntactic sign",
  NmCl: "Nominal clause", Ptcp: "Participle clause", Reop: "Reopening", Unkn: "Unknown", Voct: "Vocative clause",
  Way0: "Wayyiqtol-null clause", WayX: "Wayyiqtol-X clause", WIm0: "We-imperative-null clause",
  WImX: "We-imperative-X clause", WQt0: "We-qatal-null clause", WQtX: "We-qatal-X clause",
  WxI0: "We-x-imperative-null clause", WXIm: "We-X-imperative clause", WxIX: "We-x-imperative-X clause",
  WxQ0: "We-x-qatal-null clause", WXQt: "We-X-qatal clause", WxQX: "We-x-qatal-X clause",
  WxY0: "We-x-yiqtol-null clause", WXYq: "We-X-yiqtol clause", WxYX: "We-x-yiqtol-X clause",
  WYq0: "We-yiqtol-null clause", WYqX: "We-yiqtol-X clause", xIm0: "x-imperative-null clause",
  XImp: "X-imperative clause", xImX: "x-imperative-X clause", XPos: "Extraposition", xQt0: "x-qatal-null clause",
  XQtl: "X-qatal clause", xQtX: "x-qatal-X clause", xYq0: "x-yiqtol-null clause", XYqt: "X-yiqtol clause",
  xYqX: "x-yiqtol-X clause", ZIm0: "Zero-imperative-null clause", ZImX: "Zero-imperative-X clause",
  ZQt0: "Zero-qatal-null clause", ZQtX: "Zero-qatal-X clause", ZYq0: "Zero-yiqtol-null clause",
  ZYqX: "Zero-yiqtol-X clause",
};

export const CLAUSE_RELATION = {
  Adju: "Adjunctive clause", Attr: "Attributive clause", Cmpl: "Complement clause", Coor: "Coordinated clause",
  Objc: "Object clause", PrAd: "Predicative adjunct clause", PreC: "Predicative complement clause",
  ReVo: "Referral to the vocative", Resu: "Resumptive clause", RgRc: "Regens/rectum connection",
  Spec: "Specification clause", Subj: "Subject clause",
};

export const CLAUSE_KIND = { VC: "verbal", NC: "nominal", WP: "without predication" };

// Text type: a string read outside-in, e.g. "NQ" = a quotation inside narrative.
// The last letter is the clause's own domain.
const TEXT = { N: "Narrative", Q: "Quotation", D: "Discourse", "?": "Unknown" };
export function textType(txt) {
  const clean = (txt || "").replace(/\?/g, "");
  if (!clean) return null;
  const domain = TEXT[clean[clean.length - 1]];
  return { letter: clean[clean.length - 1], label: domain, path: [...clean].map((c) => TEXT[c]).join(" › ") };
}

// ---- MACULA Greek (New Testament) ----

export const GREEK_ROLE = {
  s: "Subject", v: "Verb", vc: "Copula (linking verb)", o: "Object", o2: "Second object",
  io: "Indirect object", p: "Predicate (complement of the copula)", adv: "Adverbial", aux: "Auxiliary",
};
export const GREEK_ROLE_SHORT = { s: "Subj", v: "Verb", vc: "Copula", o: "Obj", o2: "Obj 2", io: "Ind.obj", p: "Pred", adv: "Adverbial", aux: "Aux" };
export const GREEK_ROLE_GROUP = { v: "pred", vc: "pred", aux: "pred", s: "subj", o: "objc", o2: "objc", io: "cmpl", adv: "cmpl", p: "prec" };
export const GREEK_CLASS = {
  np: "noun phrase", vp: "verb phrase", pp: "prepositional phrase", adjp: "adjective phrase",
  advp: "adverb phrase", cl: "clause", noun: "noun", verb: "verb", adj: "adjective", adv: "adverb",
  pron: "pronoun", det: "article", prep: "preposition", conj: "conjunction", ptcl: "particle", num: "numeral",
};
const RULE_TOKEN = { S: "Subject", V: "Verb", VC: "Copula", P: "Predicate", O: "Object", O2: "Object 2", IO: "Ind. object", ADV: "Adverbial", AUX: "Aux" };
// "P-VC-S" -> "Predicate – Copula – Subject" (the constituents in Greek word order)
export const ruleLabel = (rule) => (rule || "").split("-").map((t) => RULE_TOKEN[t] || t).join(" – ");
export const GREEK_CLAUSE_ROLE = {
  s: "subject clause", o: "object clause", o2: "second-object clause", io: "indirect-object clause",
  p: "predicate clause", adv: "adverbial clause", v: "verbal clause", aux: "auxiliary clause",
};

// Role name for an occurrence (Hebrew BHSA function or Greek MACULA role).
export const roleName = (code, greek) => (greek ? GREEK_ROLE[code] : FUNCTION[code]) || null;
