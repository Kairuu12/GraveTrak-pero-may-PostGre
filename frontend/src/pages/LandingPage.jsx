import { useEffect, useState } from 'react';
import CemeteryLayoutPreview from '../components/CemeteryLayoutPreview.jsx';
import { REQUIRED_DOCUMENTS, DOCUMENT_ACCEPT, MAX_DOCUMENT_SIZE_MB } from '../data/burialRequirements.js';
import './LandingPage.css';
import graveTrakLogo from '../assets/gravetrak-logo.svg';

// Public entry points use the same map routes and requirements as the application.
function ServiceIcon({ type }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'search' ? <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>
      : type === 'route' ? <><path d="M9 19H6a3 3 0 0 1 0-6h12a3 3 0 0 0 0-6h-3" /><circle cx="6" cy="5" r="2" /><circle cx="17" cy="19" r="2" /></>
      : <><path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6" /></>}
  </svg>;
}

const SECTION_LINKS = [['Services', '#services'], ['Cemeteries', '#cemeteries'], ['Requirements', '#requirements'], ['Help', '#guide']];
const CEMETERY_PHOTOS = [
  { src: '/images/cemetery/cemetery-overview.jpg', alt: 'Concrete pathway and memorial niches at the public cemetery', label: 'A familiar place to remember' },
  { src: '/images/cemetery/memorial-chapel.jpg', alt: 'White memorial chapel surrounded by greenery', label: 'Memorial spaces' },
  { src: '/images/cemetery/family-mausoleum.jpg', alt: 'Family mausoleums beneath mature trees', label: 'Family mausoleums' },
  { src: '/images/cemetery/historic-columbarium.jpg', alt: 'Historic columbarium structure in the cemetery', label: 'Historic sections' },
  { src: '/images/cemetery/niche-wall.jpg', alt: 'Rows of memorial niches along a cemetery walkway', label: 'Niche walls' },
  { src: '/images/cemetery/cemetery-lane.jpg', alt: 'Cemetery lane between rows of memorial niches', label: 'Mapped pathways' },
];

export default function LandingPage({ onNavigate, signedIn = false, role }) {
  const [previewCemetery, setPreviewCemetery] = useState('old');
  const officeAccount = signedIn && role !== 'user';
  const workspacePath = role === 'user' ? '/map' : '/admin';
  const applicationPath = officeAccount ? '/admin' : '/apply';
  const applicationLabel = officeAccount ? 'Open Dashboard' : 'Apply for Burial';
  useEffect(() => {
    document.documentElement.classList.add('landing-page-active');
    document.body.classList.add('landing-page-active');
    return () => {
      document.documentElement.classList.remove('landing-page-active');
      document.body.classList.remove('landing-page-active');
    };
  }, []);
  const goTo = target => {
    if (target.startsWith('/')) onNavigate(target);
    else document.querySelector(target)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  };
  const services = [
    { icon: 'search', title: 'Find a loved one', text: 'Search by name, grave ID, or section and view the matching grave on the map.', action: 'Find a Grave', target: '/map' },
    { icon: 'route', title: 'Get directions', text: 'Select a grave, then choose Directions. Allow location access to start from your current position.', action: 'Choose a destination', target: '/map' },
    { icon: 'application', title: 'Apply for burial services', text: 'Submit the application and documents, then follow the review and schedule updates in your account.', action: applicationLabel, target: applicationPath },
  ];
  const questions = [
    ['Do I need an account to use the map?', 'No. Visitors can search graves and browse both cemeteries without signing in. An account is needed to submit and track a burial application.'],
    ['How do I get directions to a grave?', 'Open the map, search for a grave, select a result, then press Directions. Your browser will ask for location access when needed.'],
    ['What if my live location is unavailable?', 'Check that location services and browser location permission are enabled. If GPS is unavailable, the map labels the route as starting at the selected cemetery entrance.'],
    ['What if I cannot find the grave?', 'Try a different spelling, grave ID, or section. If no matching record appears, ask cemetery management to help verify the record.'],
    ['Does submitting an application mean it is approved?', 'No. The application and documents are reviewed by the responsible office. Sign in to follow your application status, requested corrections, and schedule updates.'],
  ];
  return <main className="landing-page">
    <a className="landing-skip-link" href="#services">Skip to services</a>
    <nav className="landing-nav" aria-label="Primary navigation">
      <button className="landing-brand" onClick={() => goTo('#home')} aria-label="GraveTrak home"><img className="brand-mark" src={graveTrakLogo} width="40" height="40" alt="" /><span>Grave<span>Trak</span></span></button>
      <div className="landing-nav-links">{SECTION_LINKS.map(([label, target]) => <button key={target} onClick={() => goTo(target)}>{label}</button>)}</div>
      <div className="landing-nav-actions"><button className="landing-login" onClick={() => goTo(signedIn ? workspacePath : '/login')}>{signedIn ? 'My workspace' : 'Sign in'}</button><button className="landing-map-button" onClick={() => goTo('/map')}>Open Map <span aria-hidden="true">&rarr;</span></button></div>
    </nav>
    <nav className="landing-mobile-links" aria-label="Page sections">{SECTION_LINKS.map(([label, target]) => <button key={target} onClick={() => goTo(target)}>{label}</button>)}</nav>
    <section className="hero-section" id="home">
      <div className="hero-copy"><p className="eyebrow">Lucena Old &amp; New Public Cemetery</p><h1>Navigate with care.<br /><em>Remember with ease.</em></h1><p className="hero-description">Find a loved one's resting place, get directions, and access burial services with GraveTrak.</p>
        <div className="hero-actions"><button className="primary-cta" onClick={() => goTo('/map')}>Find a Grave <span aria-hidden="true">&rarr;</span></button><button className="secondary-cta" onClick={() => goTo(applicationPath)}>{applicationLabel}</button></div>
        <p className="hero-trust">No account needed for grave search.</p><button className="landing-text-link" onClick={() => goTo('#how-it-works')}>First visit? See how it works <span aria-hidden="true">&darr;</span></button>
        <div className="hero-highlights" aria-label="GraveTrak highlights"><div><strong>2</strong><span>cemeteries<br />on one map</span></div><div><strong>24/7</strong><span>search access<br />for visitors</span></div><div><strong>GPS</strong><span>directions<br />to the grave</span></div></div>
      </div>
      <div className="hero-visual"><div className="hero-photo-card"><img src={CEMETERY_PHOTOS[0].src} alt={CEMETERY_PHOTOS[0].alt} fetchpriority="high" decoding="async" /><div className="hero-photo-caption"><span>Lucena City Public Cemetery</span><strong>Real places. Easier to find.</strong></div></div><div className="preview-heading"><span className="eyebrow">Explore the grounds</span><span className="preview-north" aria-hidden="true">&uarr; N</span></div><div className="preview-tabs" aria-label="Cemetery layout preview">{['old', 'new'].map(code => <button key={code} aria-pressed={previewCemetery === code} onClick={() => setPreviewCemetery(code)}>{code === 'old' ? 'Old' : 'New'} Cemetery</button>)}</div><CemeteryLayoutPreview cemetery={previewCemetery} /><div className="preview-caption"><div><strong>Cemetery layout preview</strong><small>Open the map to search current records.</small></div><button className="preview-open" aria-label={`Open ${previewCemetery} cemetery map`} onClick={() => goTo(`/map?cemetery=${previewCemetery}`)}><span>Open map</span><span aria-hidden="true">&rarr;</span></button></div></div>
    </section>
    <section className="photo-story-section" aria-labelledby="cemetery-photo-heading"><div className="section-heading photo-story-heading"><div><p className="eyebrow">See the place before you visit</p><h2 id="cemetery-photo-heading">A clearer view of the grounds.</h2></div><p>These photos show the real pathways, memorial walls, and spaces covered by GraveTrak.</p></div><div className="cemetery-photo-grid">{CEMETERY_PHOTOS.slice(1).map(photo => <figure className="cemetery-photo-card" key={photo.src}><img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" /><figcaption>{photo.label}</figcaption></figure>)}</div></section>
    <section className="landing-section" id="services"><div className="section-heading"><div><p className="eyebrow">How can we help?</p><h2>Start with what you need.</h2></div><p>One place for visitors and families to find locations and access cemetery services.</p></div><div className="feature-grid">{services.map(service => <article className="feature-card" key={service.title}><span className="feature-icon"><ServiceIcon type={service.icon} /></span><h3>{service.title}</h3><p>{service.text}</p><span className="service-access">{service.icon === 'application' ? (officeAccount ? 'Office workspace' : 'Account required') : 'No sign-in needed'}</span><button className="landing-text-link" onClick={() => goTo(service.target)}>{service.action} <span aria-hidden="true">&rarr;</span></button></article>)}</div></section>
    <section className="process-section" id="how-it-works"><p className="eyebrow">Your first visit</p><h2>From a name to a place.</h2><div className="process-flow">{[['Search', 'Enter the name, grave ID, or section in the map search bar.'], ['Select', 'Choose a matching record to see its location and grave details.'], ['Navigate', 'Press Directions and allow location access. Press Exit when finished.']].map(([title, text], index) => <div className="process-step" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></div>)}</div><button className="secondary-cta" onClick={() => goTo('/map')}>Try grave search</button></section>
    <section className="landing-section coverage-section" id="cemeteries"><div className="section-heading"><div><p className="eyebrow">Two cemeteries. One map.</p><h2>Choose where to explore.</h2></div><p>Move between both cemeteries on the same map. A regular map visit starts at Old Cemetery.</p></div><div className="coverage-grid">{['old', 'new'].map(code => <article className="coverage-card" key={code}><span className="feature-icon"><ServiceIcon type="route" /></span><div><p className="eyebrow">Lucena City</p><h3>{code === 'old' ? 'Old' : 'New'} Public Cemetery</h3><p>Explore mapped sections and search grave records.</p><button className="landing-text-link" onClick={() => goTo(`/map?cemetery=${code}`)}>View {code === 'old' ? 'Old' : 'New'} Cemetery on map <span aria-hidden="true">&rarr;</span></button></div></article>)}</div></section>
    <section className="landing-section requirements-section" id="requirements"><div><p className="eyebrow">Before you apply</p><h2>Prepare your documents.</h2><p className="section-description">These are the documents requested by the burial application form. Prepare clear, readable copies before you begin.</p><ol className="application-steps"><li>Sign in or create an account.</li><li>Complete the form and upload your documents.</li><li>Track the review and respond to office updates.</li></ol><button className="primary-cta" onClick={() => goTo(applicationPath)}>{applicationLabel}</button></div><div className="requirements-card"><h3>Burial application checklist</h3><p className="upload-guide">{DOCUMENT_ACCEPT.split(',').map(extension => extension.slice(1).toUpperCase()).join(', ')} &middot; Up to {MAX_DOCUMENT_SIZE_MB} MB per file</p><ul>{REQUIRED_DOCUMENTS.map(doc => <li key={doc.key}><span aria-hidden="true">&#10003;</span>{doc.label}</li>)}</ul><p>Submitting documents starts the review process. Approval and scheduling are confirmed by the responsible office.</p></div></section>
    <section className="landing-section faq-section" id="guide"><div><p className="eyebrow">Visitor help</p><h2>A little guidance before you go.</h2><p className="section-description">For record corrections, visiting hours, or concerns about a burial, coordinate with cemetery management.</p></div><div className="faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
    <footer className="landing-footer"><div><strong>GraveTrak</strong><p>Cemetery Geospatial Mapping and Navigation System<br />Lucena City Public Cemetery</p></div><div className="footer-links"><button onClick={() => goTo('/map')}>Find a Grave</button><button onClick={() => goTo('#requirements')}>Requirements</button><button onClick={() => goTo('#guide')}>Visitor help</button><button onClick={() => goTo(signedIn ? workspacePath : '/login')}>{signedIn ? 'My workspace' : 'Sign in'}</button></div><div className="footer-bottom"><small>&copy; {new Date().getFullYear()} GraveTrak</small><button className="back-to-top" onClick={() => goTo('#home')}>Back to top <span aria-hidden="true">&uarr;</span></button></div></footer>
  </main>;
}
