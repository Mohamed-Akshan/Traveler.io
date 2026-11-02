import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Sparkles, Send, Heart, MapPin, CalendarDays, Users, Leaf, Check,
  Pencil, Download, CloudSun, Sun, Droplets, Hotel, BedDouble, Utensils,
  CarFront, Ticket, Wallet, ArrowRight, Compass,
  ArrowLeft, AlertCircle, MessageCircle
} from 'lucide-react';
import { jsPDF } from 'jspdf';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const photo = name => `/images/${name}.jpg`;
const examples = [
  { label: 'Plan my Bali trip', description: 'Nature · Beaches · Culture', image: 'bali', prompt: 'Plan my Bali trip for 5 days. I love nature, beaches, and good food!' },
  { label: 'Romantic Paris getaway', description: 'Romance · Art · Food', image: 'paris', prompt: 'Plan a romantic 5-day trip to Paris with art, great food, and beautiful walks.' },
  { label: 'Budget trip to Japan', description: 'Tradition · Cities · Food', image: 'japan', prompt: 'Plan a budget-friendly 7-day Japan trip with culture, food, and nature.' },
  { label: 'Weekend in Dubai', description: 'Modern · Shopping · Luxury', image: 'dubai', prompt: 'Plan a 3-day Dubai weekend with sightseeing, food, and fun activities.' },
];
const stages = [
  'Mira is understanding your travel style…',
  'Finding places you’ll love…',
  'Exploring hotels and neighborhood options…',
  'Checking weather and seasonal advice…',
  'Researching realistic travel costs…',
  'Creating your day-by-day adventure…',
  'Putting the finishing touches on your escape…',
];
const iconMap = { plane: Plane, hotel: BedDouble, bed: BedDouble, food: Utensils, restaurant: Utensils, car: CarFront, activity: Ticket, beach: Sun, nature: Leaf };
const string = value => value == null ? '' : String(value);
const amount = (value, currency = 'USD') => {
  const number = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(number)) return 'Not available';
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(number); }
  catch { return `${currency} ${number.toLocaleString()}`; }
};
const short = (value, fallback = 'Not specified') => string(value).trim() || fallback;
function uid() { return (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)); }

/* ------------------------------------------------------------------ *
 * Chat message hygiene — Mira only shows clean, relevant content
 * ------------------------------------------------------------------ */
function cleanReply(raw) {
  if (raw == null) return '';
  let t = String(raw);
  t = t.replace(/```[\s\S]*?```/g, '');
  t = t.replace(/`([^`\n]*)`/g, '$1');
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  t = t.replace(/\*\*([^*\n]+)\*\*/g, '$1');
  t = t.replace(/__([^_\n]+)__/g, '$1');
  t = t.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1$2');
  t = t.replace(/\[([^\]\n]+)\]\([^)\n]*\)/g, '$1');
  t = t.replace(/^\s{0,3}[-*+]\s+/gm, '• ');
  t = t.replace(/^\s*>\s?/gm, '');
  t = t.replace(/^\s*(?:assistant|mira)\s*:\s*/i, '');
  t = t.split('\n').filter(line => {
    const s = line.trim();
    if (!s) return true;
    if (/^(?:reasoning|thought|internal[_ ]?note|system|tool(?:_?output)?)\s*:/i.test(s)) return false;
    if (/^\{/.test(s) && /"(?:selected_agents|trip_constraints|plan_data|itinerary)"/.test(s)) return false;
    if (/^\s*"?[a-z_]+"?\s*:\s*\[/.test(s)) return false;
    return true;
  }).join('\n');
  t = t.replace(/^(?:sure|of course|absolutely|certainly|no problem|great question|happy to help)[\s!,.:]+/i, '');
  t = t.replace(/\n{3,}/g, '\n\n').trim();
  if (!/[A-Za-z0-9]/.test(t)) return '';
  return t;
}

const BUDGET_RE = /\b(budget|costs?|prices?|pricing|expensive|expense|afford\w*|how much|spend|money|per person|breakdown|currency|usd|dollars?|euros?|cheap\w*)\b/i;
const isBudgetAsk = text => BUDGET_RE.test(string(text));

/* Free-typed messages that clearly ask for a NEW trip plan (not a tweak). */
const isPlanAsk = text => {
  const t = string(text).trim();
  if (!t) return false;
  if (/^(?:what|why|how|when|where|who|which|is|are|was|were|do|does|did|tell|explain|show|give)\b/i.test(t)) return false;
  return /^(?:please\s+)?(?:plan|design|create|build|draft)\b/i.test(t)
    || /^(?:new|another|fresh)\s+(?:plan|trip|itinerary)\b/i.test(t)
    || /^(?:trip|holiday|vacation|getaway)\s+to\b/i.test(t)
    || /^(?:take\s+me\s+to|i(?:'d| would)?\s+(?:like|want)\s+to\s+(?:go|visit|travel))\b/i.test(t)
    || /^(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:plan|design|create|build|draft)\b/i.test(t)
    || /\bplan\b[^.!?\n]{0,70}\b(?:trip|itinerary|holiday|vacation)\b/i.test(t);
};
const hasBudgetNumbers = budget => !!budget && (
  budget.total != null || budget.per_person != null ||
  (Array.isArray(budget.items) && budget.items.some(item => item && item.amount != null))
);
function budgetDigest(budget) {
  if (!hasBudgetNumbers(budget)) return '';
  const currency = budget.currency || 'USD';
  const facts = [];
  if (budget.total != null) facts.push(`trip total ${amount(budget.total, currency)}`);
  if (budget.per_person != null) facts.push(`per person ${amount(budget.per_person, currency)}`);
  if (budget.travelers_count != null) facts.push(`${budget.travelers_count} traveler(s)`);
  const items = (Array.isArray(budget.items) ? budget.items : []).filter(i => i && i.amount != null);
  if (items.length) facts.push('breakdown: ' + items.map(i => `${short(i.name, 'Item')} ${amount(i.amount, currency)}`).join(', '));
  if (budget.notes) facts.push(`notes: ${budget.notes}`);
  return `[Context — figures from my trip dashboard, answer with these exact numbers: ${facts.join(' | ')}]`;
}

const STORE = { plan: 'traveler_mira_plan', draft: 'traveler_mira_draft', messages: 'traveler_mira_messages', flags: 'traveler_mira_flags' };
const loadJSON = (key, fallback) => { try { const raw = sessionStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
const saveJSON = (key, value) => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ } };

function Brand({ big = false }) {
  return <span className={`brand ${big ? 'brand-large' : ''}`}>Traveler<span>.io</span><Plane size={big ? 26 : 16} className="brand-plane" /></span>;
}

function MiraLabel() {
  return <div className="mira-header"><span className="mira-avatar"><Sparkles size={22} /></span><span><strong>Mira</strong><small>Your travel buddy, always here ✈</small></span><span className="mira-online" /></div>;
}

function Progress({ stage }) {
  return <div className="progress-note"><span className="dots"><i /><i /><i /></span>{stages[stage % stages.length]}</div>;
}

function BudgetDigest({ budget }) {
  const currency = budget?.currency || 'USD';
  const items = (Array.isArray(budget?.items) ? budget.items : []).filter(item => item && item.amount != null);
  const max = Math.max(1, ...items.map(item => Number(item.amount) || 0));
  return <div className="budget-digest">
    <div className="digest-head"><span className="digest-icon"><Wallet size={15} /></span><b>Your trip budget</b><em>{short(budget?.confidence, 'estimate')}</em></div>
    <div className="digest-total">
      <span>Trip total<strong>{amount(budget?.total, currency)}</strong></span>
      <span>Per person<strong>{amount(budget?.per_person, currency)}</strong></span>
    </div>
    {items.length > 0 && <div className="digest-items">
      {items.map((item, i) => <div className="digest-item" key={i}>
        <span className="digest-name">{short(item.name, 'Item')}</span>
        <span className="digest-bar"><i style={{ width: `${Math.max(6, 100 * (Number(item.amount) || 0) / max)}%` }} /></span>
        <b>{amount(item.amount, currency)}</b>
      </div>)}
    </div>}
    {budget?.notes && <p className="digest-note">{budget.notes}</p>}
    {!items.length && !budget?.notes && <p className="digest-note">Line-item estimates are not available for this trip yet.</p>}
  </div>;
}

function ChatPanel({ messages, input, setInput, send, pending, stage, plan, reviewOpen, feedback, setFeedback, review, busyReview, compact = false }) {
  const scroll = useRef(null);
  useEffect(() => { scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' }); }, [messages, pending, plan, reviewOpen]);
  return <aside className={`chat-panel glass ${compact ? 'chat-compact' : ''}`}>
    <MiraLabel />
    <div className="chat-scroll" ref={scroll}>
      {messages.length === 0 && !pending && <div className="mira-intro"><span className="message-icon"><Sparkles size={20} /></span><div className="bubble assistant">Hey, explorer! 🌸 I'm Mira — tell me where you dream of going and I’ll map out the whole trip for you.</div></div>}
      {messages.length === 0 && !pending && <div className="quick-replies">
        <button type="button" onClick={() => send('Plan my Tokyo trip for 5 days!')}>🗼 Plan Tokyo</button>
        <button type="button" onClick={() => send('Surprise me with a trip idea for this month')}>🍂 Surprise me</button>
        <button type="button" onClick={() => send('Show my budget breakdown for this trip')}>💰 My budget</button>
      </div>}
      {messages.map(message => {
        if (message.role === 'budget') return <div className="chat-line assistant" key={message.id}>
          <span className="message-icon"><Wallet size={16} /></span>
          <BudgetDigest budget={message.data || plan?.budget} />
        </div>;
        return <div className={`chat-line ${message.role}`} key={message.id}>
          {message.role === 'assistant' && <span className="message-icon"><Sparkles size={16} /></span>}
          <div className={`bubble ${message.role}`}>{message.text}</div>
        </div>;
      })}
      {plan && <div className="mini-trip"><img src={photo('temple')} alt="A temple at sunrise" /><div><strong>{short(plan.title, 'Your dream escape')}</strong><small>{short(plan.destination)} · {plan.days?.length || '?'} days</small><span>Open your visual itinerary ✨</span></div></div>}
      {pending && <div className="mira-intro"><span className="message-icon mira-typing"><Sparkles size={18} /></span><div className="bubble assistant typing"><span className="typing-dots"><i /><i /><i /></span><em>{stages[stage % stages.length]}</em></div></div>}
      {reviewOpen && <div className="review-panel"><div className="review-title"><span className="message-icon"><Users size={18} /></span><div><strong>Review &amp; Approve</strong><small>Made for you, with your input.</small></div></div>
        <p>Your summary is ready on the left. Approve it here, or tell Mira what to change. 😊</p>
        <div className="review-actions"><button className="gradient-button" onClick={() => review(true)} disabled={busyReview}><Check size={17} /> Approve itinerary</button><button className="light-button" onClick={() => review(false)} disabled={busyReview || !feedback.trim()}><Pencil size={16} /> Request changes</button></div>
        <textarea value={feedback} maxLength={1000} onChange={e => setFeedback(e.target.value)} placeholder="Tell Mira what to change: more beach time, lower budget, a different hotel…" /><small className="counter">{feedback.length}/1000</small>
      </div>}
    </div>
    <form className="chat-compose" onSubmit={e => { e.preventDefault(); send(); }}><span className="compose-spark"><Sparkles size={18} /></span><input aria-label="Message Mira" value={input} onChange={e => setInput(e.target.value)} placeholder="Message Mira…" disabled={pending || busyReview} /><button type="submit" disabled={!input.trim() || pending || busyReview} aria-label="Send to Mira"><Send size={18} /></button></form>
    {pending ? <Progress stage={stage} /> : <div className="panel-foot">Your travel buddy, always here ✈</div>}
  </aside>;
}

function Welcome({ query, setQuery, onSend, startExample, messages, input, setInput, send, pending, stage }) {
  return <div className="welcome-page">
    <div className="backdrop"><i className="glow glow-a" /><i className="glow glow-b" /><i className="glow glow-c" /></div>
    <header className="simple-header"><Brand /><span className="header-tag"><Sparkles size={13} /> Multi-agent AI planner</span></header>
    <main className="welcome-grid">
      <section className="welcome-left"><motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="hero">
        <div className="hero-eyebrow"><Sparkles size={15} /> Your next adventure begins here</div>
        <div className="hero-sky">
          <svg className="hero-routes" viewBox="0 0 900 300" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
            <path d="M30 235 C 210 70, 400 45, 545 130" stroke="#0a1428" stroke-opacity=".3" strokeWidth="2" strokeDasharray="7 10" strokeLinecap="round" />
            <path d="M875 70 C 720 35, 575 95, 480 185" stroke="#e0a100" stroke-opacity=".65" strokeWidth="2" strokeDasharray="4 10" strokeLinecap="round" />
            <path d="M540 122 l46 12 -18 8 6 14 -9 4 -10 -14 -18 3 z" fill="#0a1428" fill-opacity=".75" />
            <path d="M474 178 l-40 14 16 7 -5 13 8 3 9 -13 15 2 z" fill="#ffd21f" stroke="#0a1428" stroke-opacity=".35" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="30" cy="235" r="6" fill="#0a1428" fill-opacity=".45" />
            <circle cx="875" cy="70" r="6" fill="#ffd21f" stroke="#0a1428" stroke-opacity=".4" strokeWidth="2" />
            <circle cx="545" cy="130" r="4" fill="#ffd21f" stroke="#0a1428" stroke-opacity=".4" strokeWidth="1.5" />
            <circle cx="480" cy="185" r="4" fill="#0a1428" fill-opacity=".5" />
          </svg>
          <h1><Brand big /></h1>
          <div className="info-chips">
            <span className="info-chip"><Sun size={14} /> Live weather research</span>
            <span className="info-chip"><Wallet size={14} /> Local-currency budgets</span>
            <span className="info-chip"><CalendarDays size={14} /> Day-by-day plans</span>
          </div>
        </div>
        <h2>Your AI Travel Buddy <span>✈</span></h2>
        <p>Dream, plan, and travel smarter with AI.<br />From inspiration to a full itinerary — all in one place.</p>
        <form className="hero-search glass" onSubmit={e => { e.preventDefault(); onSend(); }}><span className="search-spark"><Sparkles size={24} /></span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tell me your travel idea…" aria-label="Describe your trip" /><button aria-label="Start planning" type="submit" disabled={!query.trim() || pending}><Send size={23} /></button></form>
        <div className="suggestions"><button onClick={() => startExample(examples[0])}>🌴 Plan my Bali trip</button><button onClick={() => startExample(examples[1])}>💗 Romantic Paris getaway</button><button onClick={() => startExample(examples[2])}>⛩️ Budget trip to Japan</button><button onClick={() => startExample(examples[3])}>🏙️ Weekend in Dubai</button></div>
        <button onClick={onSend} disabled={!query.trim() || pending} className="hero-cta gradient-button">Build my itinerary <ArrowRight size={19} /></button>
        <div className="hero-stats" aria-label="What Mira covers">
          <span><Plane size={17} /><b>Flights</b><small>routes & transfers</small></span>
          <span><Hotel size={17} /><b>Hotels</b><small>areas & stays</small></span>
          <span><CloudSun size={17} /><b>Weather</b><small>season & packing</small></span>
          <span><Wallet size={17} /><b>Budget</b><small>cost split</small></span>
          <span><CalendarDays size={17} /><b>Itinerary</b><small>day-by-day</small></span>
        </div>
      </motion.div>
      <section className="inspiration glass"><div className="section-title"><span><Compass size={22} /> Explore Travel Inspiration</span><small>Beautiful places, thoughtful plans</small></div><div className="destination-grid">{examples.map(e => <button key={e.image} className="destination-card" onClick={() => startExample(e)}><img src={photo(e.image)} alt={e.label} /><span className="destination-shade" /><span className="destination-heart"><Heart size={18} /></span><span className="destination-copy"><strong><MapPin size={14} />{({ bali: 'Bali', paris: 'Paris', japan: 'Japan', dubai: 'Dubai' }[e.image])}</strong><small>{e.description}</small></span></button>)}</div></section>
      </section>
      <ChatPanel messages={messages} input={input} setInput={setInput} send={send} pending={pending} stage={stage} />
    </main>
  </div>;
}

function Field({ icon: Icon, title, value }) { return <div className="summary-field"><Icon size={21} /><span><small>{title}</small><strong>{value}</strong></span></div>; }

function DayCard({ data, index }) {
  const activities = Array.isArray(data.activities) ? data.activities : [];
  return <motion.article initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .06 }} className="day-card"><div className="day-photo"><img src={photo(`day${(index % 5) + 1}`)} alt={`Travel inspiration for day ${index + 1}`} /><span>Day {data.day || index + 1}</span></div><h4>{short(data.title, `Day ${index + 1} activities`)}</h4><div className="day-activities">{activities.map((a, i) => { const Icon = iconMap[a.icon] || [Plane, Leaf, Utensils, Sun, MapPin][i % 5]; return <div className="activity" key={i}><Icon size={15} /><b>{short(a.time, 'Flexible')}</b><span title={a.detail || ''}>{short(a.title, 'Explore')}</span></div>; })}{!activities.length && <p className="muted">Details available in the complete plan.</p>}</div></motion.article>;
}

function BudgetCard({ budget, onAsk }) {
  const items = (Array.isArray(budget?.items) ? budget.items : []).filter(item => item && item.amount != null);
  const currency = budget?.currency || 'USD';
  const max = Math.max(1, ...items.map(a => Number(a.amount) || 0));
  const known = items.length > 0 || budget?.total != null || budget?.per_person != null;
  return <section className="info-card glass budget-card">
    <div className="info-heading"><h3><Wallet size={19} /> Estimated Budget</h3><span className="soft-tag">{budget?.per_person != null ? `${amount(budget.per_person, currency)} / person` : short(budget?.confidence, 'estimate')}</span></div>
    {known ? <>
      <div className="budget-lines">{items.length ? items.map((item, i) => { const Icon = [Plane, BedDouble, Utensils, CarFront, Ticket][i % 5]; return <div key={i} className="budget-line"><Icon size={16} /><span className="budget-name">{short(item.name, 'Item')}</span><div className="meter"><span style={{ width: `${Math.max(5, 100 * Number(item.amount) / max)}%` }} /></div><b>{amount(item.amount, currency)}</b></div>; }) : <p className="muted">Totals only — ask Mira for a full breakdown.</p>}</div>
      <div className="budget-total"><span>Estimated trip total</span><strong>{amount(budget?.total, currency)}</strong></div>
      {budget?.travelers_count != null && <p className="data-note">Based on {budget.travelers_count} traveler(s).</p>}
      <p className="data-note">{short(budget?.notes, 'Planning estimates, not live booking quotes.')}</p>
    </> : <div className="budget-empty"><AlertCircle size={18} /><p>Mira hasn’t produced budget numbers for this trip yet.</p><button className="light-button" onClick={onAsk}><Sparkles size={15} /> Ask Mira for my budget</button></div>}
  </section>;
}

function WeatherCard({ weather, destination }) {
  return <section className="info-card glass weather-card"><div className="info-heading"><h3><Sun size={19} /> Weather in {short(destination, 'your destination').split(',')[0]}</h3><span className="soft-tag">OpenWeather research</span></div><div className="weather-current"><CloudSun className="sun-art" size={63} /><span><strong>{weather?.temperature != null ? `${weather.temperature}°C` : '—'}</strong><small>{short(weather?.condition, 'No live forecast available')}</small></span><span className="weather-extra">{weather?.humidity != null && <small><Droplets size={13} /> Humidity {weather.humidity}%</small>}<small><CloudSun size={13} /> Forecast depends on travel dates</small></span></div><div className="forecast-mini">{Array.isArray(weather?.forecast) && weather.forecast.length ? weather.forecast.slice(0, 5).map((x, i) => <div key={i}><small>{short(x.day, `Day ${i + 1}`)}</small><Sun size={20} /><b>{x.temperature != null ? `${x.temperature}°` : '—'}</b></div>) : <p>For future trips, Mira provides seasonal guidance rather than inventing an exact forecast.</p>}</div><p className="data-note">{short(weather?.note, 'Check the forecast closer to departure.')}</p></section>;
}

function HotelCard({ hotel }) { return <section className="info-card glass hotel-card"><div className="info-heading"><h3><Hotel size={19} /> Recommended Stay</h3></div><div className="hotel-picture"><img src={photo('hotel')} alt="Tropical hotel inspiration" /><div><strong>{short(hotel?.name, 'Accommodation ideas')}</strong><small>{short(hotel?.area, 'Destination area')}</small></div></div><p>{short(hotel?.description, 'Mira will suggest a suitable area and accommodation based on your travel style.')}</p>{hotel?.booking_url?.startsWith('https://') && <a href={hotel.booking_url} target="_blank" rel="noreferrer">Explore accommodation <ArrowRight size={14} /></a>}<small className="data-note">Hotel image is illustrative; availability is not confirmed.</small></section>; }

function FlightsCard({ flights }) { return <section className="info-card glass flights-card"><div className="info-heading"><h3><Plane size={19} /> Flights &amp; Transfers</h3></div><div className="flight-route"><Plane size={22} /><div><strong>Outbound journey</strong><span>{short(flights?.outbound, 'Check airlines for available routes')}</span></div></div><div className="flight-route"><Plane size={22} /><div><strong>Return journey</strong><span>{short(flights?.inbound, 'Return details not specified')}</span></div></div><p className="data-note">{short(flights?.notes, 'Flights and prices are not booked or confirmed.')}</p>{flights?.estimated_price != null && <div className="flight-estimate">Estimated fare: {amount(flights.estimated_price)}</div>}</section>; }

function downloadPDF(plan, draft = '', approved = false) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210, margin = 17, usable = 176;
  let y = 22;
  // jsPDF's built-in fonts are ASCII-only: transliterate typographic characters first.
  const pdfText = value => string(value)
    .replace(/[–—]/g, '-').replace(/[‘’‚]/g, "'").replace(/[“”]/g, '"')
    .replace(/•/g, '-').replace(/…/g, '...').replace(/°/g, ' deg ')
    .replace(/ /g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ').trim();
  const heading = (text, size = 13) => {
    if (y > 260) next();
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(size); pdf.setTextColor(10, 16, 36);
    const parts = pdf.splitTextToSize(pdfText(text), usable);
    for (const part of parts) { if (y > 274) next(); pdf.text(part, margin, y); y += size * .65 + 3.4; }
    y += 1.5;
  };
  const line = (text, size = 10) => {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(size); pdf.setTextColor(45, 56, 84);
    const parts = pdf.splitTextToSize(pdfText(text), usable);
    for (const part of parts) { if (y > 279) next(); pdf.text(part, margin, y); y += 5.6; }
  };
  const next = () => { pdf.addPage(); y = 22; };
  const money = (value, currency) => {
    const rendered = amount(value, currency);
    return rendered === 'Not available' ? '' : rendered;
  };

  // Header
  pdf.setFillColor(236, 243, 255); pdf.rect(0, 0, pageW, 49, 'F');
  pdf.setTextColor(11, 46, 166); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.text('Traveler.io  /  Your trip with Mira', margin, 22);
  pdf.setTextColor(10, 16, 36); pdf.setFontSize(15); pdf.text(pdfText(short(plan.title, 'Your Travel Itinerary')), margin, 36);
  pdf.setFillColor(255, 210, 31); pdf.rect(margin, 45, 46, 3.2, 'F');
  pdf.setTextColor(10, 16, 36); pdf.setFontSize(9.5); pdf.setFont('helvetica', 'bold');
  pdf.text(approved ? 'APPROVED ITINERARY' : 'DRAFT - AWAITING REVIEW', margin, 57);
  pdf.setDrawColor(255, 210, 31); pdf.setLineWidth(1.4); pdf.line(margin, 61, pageW - margin, 61);
  y = 69;

  line(`${short(plan.destination)}  |  ${short(plan.dates)}  |  ${short(plan.travelers)}${plan.travel_style ? `  |  ${plan.travel_style}` : ''}`);
  line(short(plan.summary)); y += 5;

  const days = Array.isArray(plan.days) ? plan.days : [];
  if (days.length) {
    heading(`${days.length}-Day Itinerary`);
    for (const day of days) {
      heading(`Day ${day?.day || ''} - ${short(day?.title, 'Day plan')}`, 12.5);
      for (const activity of day?.activities || []) {
        line(`${short(activity?.time, 'Flexible')}  -  ${short(activity?.title)}${activity?.detail ? `: ${activity.detail}` : ''}`);
      }
      y += 3;
    }
  } else if (draft) {
    heading('Complete itinerary');
    line(pdfText(String(draft).replace(/```[\s\S]*?```/g, '').replace(/^#{1,6}\s+/gm, '').replace(/\*\*/g, '')));
  }
  y += 3;

  const budget = plan.budget || {};
  const items = (Array.isArray(budget.items) ? budget.items : []).filter(item => item && item.amount != null && Number(item.amount) !== 0);
  const total = money(budget.total, budget.currency);
  const perPerson = money(budget.per_person, budget.currency);
  if (items.length || total || perPerson) {
    heading('Estimated budget');
    line(budget.currency ? `Currency: ${budget.currency} (destination local currency) - estimates only, nothing is booked.` : 'Estimates only - nothing is booked.');
    for (const item of items) line(`${short(item.name, 'Item')}: ${money(item.amount, budget.currency)}`);
    if (perPerson) line(`Per person: ${perPerson}${budget.travelers_count ? `  (x ${budget.travelers_count} travellers)` : ''}`);
    if (total) line(`Trip total: ${total}`);
    if (budget.notes) line(short(budget.notes));
    y += 3;
  }

  const weather = plan.weather || {};
  if (weather.condition || weather.temperature != null || weather.note) {
    heading('Weather');
    line(`${weather.temperature != null ? `Typical/current temperature: ${string(weather.temperature)}  -  ` : ''}${short(weather.condition, 'Seasonal guidance')}${weather.humidity ? `  -  Humidity: ${weather.humidity}` : ''}`);
    if (weather.note) line(short(weather.note));
    y += 3;
  }

  const hotel = plan.hotel || {};
  if (hotel.name || hotel.description) {
    heading('Accommodation');
    line(`${short(hotel.name, 'Neighbourhood stay ideas')}${hotel.area ? ` / ${hotel.area}` : ''}${hotel.estimated_price != null ? `  -  est. ${money(hotel.estimated_price, budget.currency)}` : ''}`);
    if (hotel.description) line(short(hotel.description));
    y += 3;
  }

  const flights = plan.flights || {};
  if (flights.outbound || flights.inbound || flights.notes) {
    heading('Flights & transfers');
    if (flights.outbound) line(`Outbound: ${flights.outbound}`);
    if (flights.inbound) line(`Return: ${flights.inbound}`);
    if (flights.estimated_price != null) line(`Estimated fare: ${money(flights.estimated_price, budget.currency)}`);
    if (flights.notes) line(short(flights.notes));
    y += 3;
  }

  if (Array.isArray(plan.tips) && plan.tips.length) {
    heading('Good to know');
    for (const tip of plan.tips) line(`- ${tip}`);
  }

  // Footer with generation date + page numbers on every page
  const pages = pdf.internal.getNumberOfPages();
  const stamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(130, 140, 160);
    pdf.text(`Generated ${stamp} by Traveler.io Mira  -  all prices are estimates, nothing is booked`, margin, 290);
    pdf.text(`Page ${p} / ${pages}`, pageW - margin, 290, { align: 'right' });
  }

  pdf.save(`Traveler.io-${pdfText(short(plan.destination, 'Trip')).replace(/[^\w]+/g, '-')}.pdf`);
}

function Dashboard({ plan, messages, input, setInput, send, pending, stage, reviewOpen, feedback, setFeedback, review, busyReview, approved, goBack, draft, askBudget }) {
  const days = Array.isArray(plan.days) ? plan.days : [];
  const [showFull, setShowFull] = useState(false);
  return <div className="dashboard-page"><div className="backdrop"><i className="glow glow-a" /><i className="glow glow-b" /><i className="glow glow-c" /></div>
    <header className="dashboard-top"><Brand />
      <span className="top-status">{reviewOpen ? <span className="status-chip warn"><Sparkles size={14} /> Awaiting your review</span> : approved ? <span className="status-chip ok"><Check size={14} /> Itinerary approved</span> : <span className="status-chip"><Compass size={14} /> Trip dashboard</span>}</span>
      <button onClick={goBack} className="back-button"><ArrowLeft size={16} /> New adventure</button>
    </header>
    <main className="dashboard-grid">
      <div className="dashboard-main">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="summary-panel glass">
          <div className="summary-top"><span className="summary-kicker"><Sparkles size={14} /> Trip summary</span>
            <div className="heading-tools"><span className="active-pill"><CalendarDays size={15} /> Itinerary</span><span className="subtle-pill">{days.length ? `${days.length}-day plan` : 'Draft plan'}</span></div>
          </div>
          <h1>{short(plan.title, 'Your Dream Escape')} <span>✦</span></h1>
          <p className="summary-lede">{short(plan.summary, 'An unforgettable journey planned with Mira, your AI travel buddy.')}</p>
          <div className="summary-fields">
            <Field icon={MapPin} title="Destination" value={short(plan.destination)} />
            <Field icon={CalendarDays} title="Dates" value={short(plan.dates)} />
            <Field icon={Users} title="Travelers" value={short(plan.travelers)} />
            <Field icon={Leaf} title="Travel style" value={short(plan.travel_style)} />
          </div>
          {reviewOpen && <div className="review-quick">
            <div className="review-quick-copy"><b>Your summary is ready</b><small>Approve it here, or refine anything with Mira in the chat →</small></div>
            <div className="review-quick-actions">
              <button className="gradient-button" onClick={() => review(true)} disabled={busyReview}><Check size={16} /> Approve itinerary</button>
              <button className="light-button" disabled={busyReview} onClick={() => document.querySelector('.chat-compose input')?.focus()}><Pencil size={15} /> Refine with Mira</button>
            </div>
          </div>}
          {approved && <div className="approved-note"><Check size={15} /> Approved — your itinerary is final. Ask Mira anything about it, budget included.</div>}
        </motion.section>

        <section className="itinerary-section glass">
          <div className="section-title"><span><CalendarDays size={22} /> Your {days.length ? `${days.length}-Day` : ''} Itinerary</span>
            <div className="section-actions"><button onClick={() => setShowFull(v => !v)} className="light-button">{showFull ? 'Hide full plan' : 'Full AI plan'}</button><button className="light-button" onClick={() => downloadPDF(plan, draft, approved)}><Download size={17} /> Download PDF</button></div>
          </div>
          {days.length ? <div className="days-grid">{days.map((day, i) => <DayCard data={day} index={i} key={i} />)}</div> : <div className="empty-itinerary"><AlertCircle size={24} /> Mira couldn't format daily cards from this response. View the full AI plan below.</div>}
          {(showFull || !days.length) && <div className="full-plan"><h3>Complete itinerary</h3><pre>{draft || 'No detailed itinerary was returned.'}</pre></div>}
        </section>

        <div className="bottom-grid">
          <BudgetCard budget={plan.budget || {}} onAsk={askBudget} />
          <WeatherCard weather={plan.weather || {}} destination={plan.destination} />
          <HotelCard hotel={plan.hotel || {}} />
          <FlightsCard flights={plan.flights || {}} />
        </div>
        <p className="footer-disclaimer">Made with care by Mira · Images are illustrative · Travel prices and conditions should be checked before booking</p>
      </div>
      <ChatPanel compact messages={messages} input={input} setInput={setInput} send={send} pending={pending} stage={stage} plan={plan} reviewOpen={reviewOpen} feedback={feedback} setFeedback={setFeedback} review={review} busyReview={busyReview} />
    </main>
  </div>;
}

export default function App() {
  const [thread, setThread] = useState(() => {
    try { const key = 'traveler_mira_thread'; const old = sessionStorage.getItem(key); if (old) return old; const next = uid(); sessionStorage.setItem(key, next); return next; }
    catch { return uid(); }
  });
  const rotateThread = () => {
    const next = uid();
    setThread(next);
    try { sessionStorage.setItem('traveler_mira_thread', next); } catch { /* private mode */ }
    return next;
  };
  const restoredPlan = loadJSON(STORE.plan, null);
  const restoredFlags = loadJSON(STORE.flags, {});
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => loadJSON(STORE.messages, []));
  const [plan, setPlan] = useState(restoredPlan);
  const [draft, setDraft] = useState(loadJSON(STORE.draft, ''));
  const [pending, setPending] = useState(false);
  const [busyReview, setBusyReview] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(!!restoredFlags.reviewOpen && !!restoredPlan);
  const [approved, setApproved] = useState(!!restoredFlags.approved);
  const [feedback, setFeedback] = useState('');
  const [awaitingPlan, setAwaitingPlan] = useState(() => {
    try { return sessionStorage.getItem('traveler_mira_awaiting') === '1'; } catch { return false; }
  });
  const setAwaiting = value => {
    setAwaitingPlan(value);
    try {
      if (value) sessionStorage.setItem('traveler_mira_awaiting', '1');
      else sessionStorage.removeItem('traveler_mira_awaiting');
    } catch { /* private mode */ }
  };
  const [stage, setStage] = useState(0);
  const interval = useRef(null);
  useEffect(() => () => clearInterval(interval.current), []);
  useEffect(() => { saveJSON(STORE.plan, plan); }, [plan]);
  useEffect(() => { saveJSON(STORE.draft, draft); }, [draft]);
  useEffect(() => { saveJSON(STORE.messages, messages); }, [messages]);
  useEffect(() => { saveJSON(STORE.flags, { reviewOpen, approved }); }, [reviewOpen, approved]);

  const add = (role, text, data) => setMessages(prev => [...prev, { id: uid(), role, text, data }]);

  async function request(path, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
      const response = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.detail === 'string'
          ? data.detail
          : `Backend returned HTTP ${response.status}`);
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('The request took over 2 minutes. Check the FastAPI terminal for slow model or API calls.');
      }
      if (error instanceof TypeError) {
        throw new Error('Cannot reach FastAPI. Open http://127.0.0.1:8000/api/health and check that the backend is running.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  const begin = () => { setPending(true); setStage(0); interval.current = setInterval(() => setStage(s => (s + 1) % stages.length), 3400); };
  const end = () => { clearInterval(interval.current); setPending(false); };

  async function sendMessage(text, mode = 'chat') {
    if (!text.trim() || pending || busyReview) return;
    setQuery(''); setInput(''); add('user', text);

    // Route free-typed chat lines to the right pipeline so the dashboard always updates.
    if (mode === 'chat') {
      if (reviewOpen && !isPlanAsk(text)) {
        // A draft is awaiting review: treat plain chat as change feedback for it.
        await submitReview(false, text, true);
        return;
      }
      // New plan request, or Mira is waiting on trip details: keep the plan pipeline.
      if (isPlanAsk(text) || awaitingPlan) mode = 'plan';
    }

    // Every fresh plan run gets its own thread so a pending old draft can't block it.
    // While awaiting trip details we stay on the same thread to keep the context.
    const activeThread = mode === 'plan' && !awaitingPlan ? rotateThread() : thread;
    const digest = mode !== 'plan' && isBudgetAsk(text) ? budgetDigest(plan?.budget) : '';
    const outbound = digest ? `${text}\n\n${digest}` : text;
    begin();
    try {
      const result = await request('/api/chat', { thread_id: activeThread, message: outbound, mode });
      const reply = cleanReply(result.reply);
      if (reply) add('assistant', reply);
      if (result.status === 'clarify') {
        setAwaiting(true);
      } else if (result.status === 'awaiting_approval') {
        setAwaiting(false);
        setDraft(result.draft || '');
        if (result.plan && Object.keys(result.plan).length) {
          setPlan(prev => (reviewOpen && prev ? { ...prev, ...result.plan } : result.plan));
        }
        setReviewOpen(true);
        setApproved(false);
      } else {
        setAwaiting(false);
        if (digest && hasBudgetNumbers(plan?.budget)) add('budget', '', plan.budget);
      }
    } catch (error) {
      add('assistant', `I couldn't reach the planner just now. ${error.message}`);
    } finally { end(); }
  }

  async function submitReview(isApproved, feedbackText = feedback, userAlreadyAdded = false) {
    if (busyReview) return;
    const fb = string(feedbackText).trim();
    if (!isApproved && !fb) return;
    setBusyReview(true); begin();
    if (!userAlreadyAdded && !isApproved) add('user', fb);
    try {
      const result = await request('/api/review', { thread_id: thread, approved: isApproved, feedback: fb });
      const reply = cleanReply(result.reply);
      if (reply) add('assistant', reply);
      if (result.plan && Object.keys(result.plan).length) {
        setPlan(prev => (prev ? { ...prev, ...result.plan } : result.plan));
      }
      if (result.draft) setDraft(result.draft);
      if (result.status === 'awaiting_approval') { setReviewOpen(true); setApproved(false); setFeedback(''); }
      else { setReviewOpen(false); setApproved(isApproved); setFeedback(''); }
    } catch (error) { add('assistant', `I couldn't submit your review: ${error.message}`); } finally { end(); setBusyReview(false); }
  }
  const review = isApproved => submitReview(isApproved, feedback, false);

  function startExample(e) { setQuery(e.prompt); sendMessage(e.prompt, 'plan'); }
  function goBack() {
    setPlan(null); setReviewOpen(false); setApproved(false); setDraft(''); setQuery('');
    setMessages([]); setInput(''); setFeedback(''); setAwaiting(false);
    saveJSON(STORE.plan, null); saveJSON(STORE.draft, ''); saveJSON(STORE.messages, []); saveJSON(STORE.flags, { reviewOpen: false, approved: false });
    rotateThread();
  }
  const askBudget = () => sendMessage('Show my budget breakdown for this trip', 'chat');
  const sendFromChat = text => sendMessage(typeof text === 'string' && text.trim() ? text : input, 'chat');

  return <AnimatePresence mode="wait">
    {plan ? <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Dashboard plan={plan} messages={messages} input={input} setInput={setInput} send={sendFromChat} pending={pending} stage={stage} reviewOpen={reviewOpen} feedback={feedback} setFeedback={setFeedback} review={review} busyReview={busyReview} approved={approved} goBack={goBack} draft={draft} askBudget={askBudget} />
    </motion.div> : <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Welcome query={query} setQuery={setQuery} onSend={() => sendMessage(query, 'plan')} startExample={startExample} messages={messages} input={input} setInput={setInput} send={sendFromChat} pending={pending} stage={stage} />
    </motion.div>}
  </AnimatePresence>;
}
