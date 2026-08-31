/* Theme detection now runs inline in <head> (index.html) so it applies
   before first paint — see the comment there for why it moved out of
   this deferred file. */

/* ───────────────────────────────────────────
   LOADING SCREEN
─────────────────────────────────────────── */
(function(){
  const screen = document.getElementById('loading-screen');
  const counter = document.getElementById('loading-counter');
  const bar = document.getElementById('loading-bar');
  const wordEl = document.getElementById('loading-word');
  const words = ['Design','Create','Inspire'];
  let wordIdx = 0, count = 0;
  const duration = 2700, start = performance.now();

  function cycleWord(){
    wordEl.classList.add('exit');
    setTimeout(() => {
      wordIdx = (wordIdx + 1) % words.length;
      wordEl.textContent = words[wordIdx];
      wordEl.classList.remove('exit');
      wordEl.classList.add('enter');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => wordEl.classList.remove('enter'));
      });
    }, 300);
  }
  const wordInterval = setInterval(cycleWord, 900);

  let finished = false;

  function finish(){
    if(finished) return;
    finished = true;
    clearInterval(wordInterval);
    clearTimeout(watchdog);
    setTimeout(() => {
      screen.classList.add('hide');
      setTimeout(() => { screen.style.display='none'; initPage(); }, 600);
    }, 400);
  }

  function tick(now){
    const elapsed = now - start;
    count = Math.min(100, Math.floor((elapsed / duration) * 100));
    counter.textContent = String(count).padStart(3,'0');
    bar.style.transform = `scaleX(${count/100})`;
    if(count < 100) requestAnimationFrame(tick);
    else finish();
  }

  // requestAnimationFrame pauses in background tabs, so guarantee completion
  const watchdog = setTimeout(finish, duration + 2000);
  requestAnimationFrame(tick);
})();

/* ───────────────────────────────────────────
   INIT after loading
─────────────────────────────────────────── */
function initPage(){
  initVideo();
  // Works/Journal inject real content into what were empty grid containers,
  // which changes the page's height. That MUST happen before initGSAP(),
  // because GSAP's ScrollTrigger measures scroll positions (like the
  // Explorations pin's "top top"/"bottom bottom") against the page height
  // at the moment it's set up. Previously initGSAP() ran first, so every
  // Explorations trigger was calculated against a shorter page — that's
  // what made the section start pinning/animating at the wrong scroll
  // offset (feeling like you "enter" it before it's actually ready).
  initWorks();
  initExperience();
  initEducation();
  initCertifications();
  initJournal();
  initLazyLoad();
  initGSAP();
  initRoles();
  initMarquee();
  initScrollReveal();
  initLightbox();
  initNavScroll();
  initNavLinks();
  initThemeToggle();
  initButtons();
  initBackToTop();
  initScrollProgress();
  initToast();
}

/* ───────────────────────────────────────────
   HLS VIDEO
─────────────────────────────────────────── */
function loadHLS(videoEl, src){
  if(typeof Hls !== 'undefined' && Hls.isSupported()){
    const hls = new Hls({ maxBufferLength: 30, startFragPrefetch: true });
    hls.loadSource(src);
    hls.attachMedia(videoEl);
    hls.on(Hls.Events.ERROR, (_, data) => {
      if(data.fatal) console.warn('HLS fatal error:', data.type, data.details);
    });
  } else if(videoEl.canPlayType('application/vnd.apple.mpegurl')){
    videoEl.src = src;
  }
  const playPromise = videoEl.play();
  if(playPromise && playPromise.catch) playPromise.catch(()=>{});
}
function initVideo(){
  const src = 'https://stream.mux.com/Aa02T7oM1wH5Mk5EEVDYhbZ1ChcdhRsS2m1NYyx4Ua1g.m3u8';
  const hero = document.getElementById('hero-video');
  const footer = document.getElementById('footer-video');
  loadHLS(hero, src);
  // Footer video uses the same stream — defer it until it's near the viewport
  if('IntersectionObserver' in window && footer){
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if(e.isIntersecting){
          loadHLS(footer, src);
          obs.disconnect();
        }
      });
    }, { rootMargin:'600px 0px' });
    obs.observe(footer);
  } else if(footer){
    loadHLS(footer, src);
  }
}

/* ───────────────────────────────────────────
   LAZY-LOADED IMAGES
   Native `loading="lazy"` leaves the fetch-start distance up to the
   browser, which is often too small once a fast-scrolling / pinned
   section (like Explorations) is involved — the section becomes visible
   before the image has actually finished (or even started) downloading.
   This preloads images a good ~1200px BEFORE they reach the viewport, and
   fades them in once decoded, so nothing pops in empty mid-scroll.
─────────────────────────────────────────── */
function initLazyLoad(){
  const imgs = document.querySelectorAll('img[data-src]');
  if(!imgs.length) return;

  const loadImg = (img) => {
    const src = img.dataset.src;
    if(!src) return;
    delete img.dataset.src;
    img.addEventListener('load', () => img.classList.add('loaded'), { once:true });
    img.src = src;
    if(img.complete) img.classList.add('loaded');
  };

  if(!('IntersectionObserver' in window)){
    imgs.forEach(loadImg);
    return;
  }

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        loadImg(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, { rootMargin: '1200px 0px', threshold: 0 });

  imgs.forEach(img => obs.observe(img));
}

/* ───────────────────────────────────────────
   GSAP HERO ENTRANCE
─────────────────────────────────────────── */
function initGSAP(){
  if(typeof gsap === 'undefined'){
    // CDN unavailable — reveal hero content that CSS starts hidden
    document.querySelectorAll('.name-reveal, .blur-in').forEach(el => { el.style.opacity = 1; });
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  // Hero entrance
  const tl = gsap.timeline({ defaults:{ ease:'power3.out' } });
  tl.fromTo('.name-reveal', { opacity:0, y:50 }, { opacity:1, y:0, duration:1.2, delay:0.1 })
    .from('.blur-in', {
      opacity:0, filter:'blur(10px)', y:20, duration:1,
      stagger:0.1
    }, '-=0.8');

  // Exploration parallax
  const items = document.querySelectorAll('.explore-item');
  if(items.length){
    // Column 1 (odd items): scroll up
    const col1 = [items[0], items[2], items[4]];
    // Column 2 (even items): scroll down
    const col2 = [items[1], items[3], items[5]];

    col1.forEach((el, i) => {
      gsap.fromTo(el,
        { y: 80 + i * 20 },
        {
          y: -(80 + i * 20), ease:'none',
          scrollTrigger:{ trigger:'#explorations', start:'top bottom', end:'bottom top', scrub:true }
        }
      );
    });
    col2.forEach((el, i) => {
      gsap.fromTo(el,
        { y: -(60 + i * 20) },
        {
          y: 60 + i * 20, ease:'none',
          scrollTrigger:{ trigger:'#explorations', start:'top bottom', end:'bottom top', scrub:true }
        }
      );
    });

    // Pin center content while scrolling through section
    ScrollTrigger.create({
      trigger:'#explorations',
      start:'top top',
      end:'bottom bottom',
      pin:'#explore-pin',
      pinSpacing:false
    });
  }
}

/* Safety net: if web fonts finish swapping in, or any late-loading asset
   changes layout, after initGSAP() already measured the page, refresh
   ScrollTrigger so pin/parallax offsets stay correct instead of drifting. */
window.addEventListener('load', () => {
  if(typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
});
if(document.fonts && document.fonts.ready){
  document.fonts.ready.then(() => {
    if(typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
  }).catch(()=>{});
}

/* ───────────────────────────────────────────
   HERO — Role cycling
─────────────────────────────────────────── */
function initRoles(){
  const roles = ['IT Specialist','Web Developer','Pharmacist','Designer'];
  let idx = 0;
  const el = document.getElementById('role-word');
  const id = setInterval(() => {
    el.style.animation = 'none';
    void el.offsetWidth;
    idx = (idx+1) % roles.length;
    el.textContent = roles[idx];
    el.style.animation = 'roleFadeIn 0.4s ease-out';
  }, 2000);
  // Cleanup on page unload to prevent memory leak
  window.addEventListener('beforeunload', () => clearInterval(id));
}

/* ───────────────────────────────────────────
   MARQUEE
─────────────────────────────────────────── */
function initMarquee(){
  if(typeof gsap === 'undefined') return;
  const track = document.getElementById('marquee-track');
  const text = 'BUILDING THE FUTURE • ';
  for(let i=0;i<6;i++){
    const span = document.createElement('span');
    span.className = 'marquee-text';
    span.textContent = text;
    track.appendChild(span);
  }
  gsap.to(track, {
    xPercent: -50, duration:40,
    ease:'none', repeat:-1
  });
}

/* ───────────────────────────────────────────
   SCROLL REVEAL (IntersectionObserver)
─────────────────────────────────────────── */
function initScrollReveal(){
  const els = document.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window)){
    els.forEach(el => el.classList.add('visible'));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting){
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { rootMargin:'-80px', threshold:0.1 });
  els.forEach(el => obs.observe(el));
}

/* ───────────────────────────────────────────
   LIGHTBOX (accessible: focus trap, arrow nav)
─────────────────────────────────────────── */
function initLightbox(){
  const items = document.querySelectorAll('.explore-item');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const closeBtn = document.getElementById('lightbox-close');
  const prevBtn = lightbox.querySelector('.lightbox-prev');
  const nextBtn = lightbox.querySelector('.lightbox-next');
  let activeIndex = 0;
  let lastFocused = null;

  function openLightbox(index){
    activeIndex = index;
    lastFocused = document.activeElement;
    const src = items[index].dataset.img;
    lightboxImg.src = src;
    lightboxImg.alt = items[index].querySelector('img')?.alt || '';
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
    document.addEventListener('keydown', handleLightboxKeys);
  }

  function closeLightbox(){
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleLightboxKeys);
    if(lastFocused) lastFocused.focus();
  }

  function showNext(e){
    e?.preventDefault();
    activeIndex = (activeIndex + 1) % items.length;
    const src = items[activeIndex].dataset.img;
    lightboxImg.src = src;
    lightboxImg.alt = items[activeIndex].querySelector('img')?.alt || '';
  }

  function showPrev(e){
    e?.preventDefault();
    activeIndex = (activeIndex - 1 + items.length) % items.length;
    const src = items[activeIndex].dataset.img;
    lightboxImg.src = src;
    lightboxImg.alt = items[activeIndex].querySelector('img')?.alt || '';
  }

  function handleLightboxKeys(e){
    if(e.key === 'Escape') closeLightbox();
    if(e.key === 'ArrowRight') showNext();
    if(e.key === 'ArrowLeft') showPrev();
    if(e.key === 'Tab'){
      const focusable = lightbox.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
      if(focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if(e.shiftKey){
        if(document.activeElement === first){ e.preventDefault(); last.focus(); }
      } else {
        if(document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    }
  }

  items.forEach((item, i) => {
    item.addEventListener('click', () => openLightbox(i));
    item.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') openLightbox(i); });
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
  });

  lightbox.addEventListener('click', function(e){
    if(e.target === this) closeLightbox();
  });
  closeBtn.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', showPrev);
  nextBtn.addEventListener('click', showNext);
}

/* ───────────────────────────────────────────
   NAV SCROLL SHADOW
─────────────────────────────────────────── */
function initNavScroll(){
  const pill = document.getElementById('nav-pill');
  let ticking = false;
  window.addEventListener('scroll', () => {
    if(!ticking){
      requestAnimationFrame(() => {
        pill.classList.toggle('scrolled', window.scrollY > 100);
        ticking = false;
      });
      ticking = true;
    }
  }, { passive:true });
}

/* ───────────────────────────────────────────
   NAV ACTIVE LINKS (smooth scroll)
─────────────────────────────────────────── */
function initNavLinks(){
  const links = document.querySelectorAll('.nav-link');
  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = link.getAttribute('href');
      if(target && target.startsWith('#')){
        document.querySelector(target)?.scrollIntoView({ behavior:'smooth' });
      }
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  // Update active on scroll
  const sections = ['hero','about','works','experience','education','certifications','journal','explorations','stats','contact'];
  const workGroup = ['experience','education','certifications','journal','explorations'];
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if(e.isIntersecting){
        const id = e.target.id;
        links.forEach(l => {
          const href = l.getAttribute('href');
          l.classList.toggle('active',
            href === '#'+id ||
            (workGroup.includes(id) && href === '#works')
          );
        });
      }
    });
  }, { threshold:0.4 });
  sections.forEach(id => {
    const el = document.getElementById(id);
    if(el) obs.observe(el);
  });
}

function initThemeToggle(){
  const toggle = document.getElementById('theme-toggle');
  toggle.addEventListener('click', () => {
    const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    try { localStorage.setItem('theme', nextTheme); } catch(e){}
  });
}

/* ───────────────────────────────────────────
   BUTTONS (data-scroll)
─────────────────────────────────────────── */
function initButtons(){
  document.querySelectorAll('[data-scroll]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.scroll;
      if(target) document.getElementById(target)?.scrollIntoView({ behavior:'smooth' });
    });
  });
}

/* ───────────────────────────────────────────
   CONTENT — Works & Journal (data-driven)
─────────────────────────────────────────── */
const works = [
  { src: 'https://images.unsplash.com/photo-1618171889969-0feeb769fe78?w=1600&q=80', title: 'IT Support & Troubleshooting' },
  { src: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=1600&q=80', title: 'Web Development' },
  { src: 'https://images.unsplash.com/photo-1580281657527-47f249e8f4df?w=1600&q=80', title: 'Pharmacy & Patient Care' },
  { src: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=1600&q=80', title: 'Medical Assistance' }
];

const education = [
  { period:'2016 – 2026', title:'Bachelor of Science in Chemistry', org:'National University of Bangladesh', desc:'Obtained a Bachelor of Science in Chemistry, focusing on chemical analysis and laboratory techniques.' },
  { period:'2016 – 2017', title:'Certificate in Health Technology and Services', org:'Noakhali Paramedical College', desc:'Earned a Certificate in Health Technology and Services, enhancing healthcare delivery skills.' }
];

const certifications = [
  'IT Support Technician',
  'Web Development Course',
  'Certificate in Pharma Technology',
  'Pharmacy Trade License',
  'Diploma in Nursing',
  'Professional Driving License',
  'NSDA Driving, Level-3'
];

const skills = [
  { name: 'IT Support & Troubleshooting', pct: 95 },
  { name: 'Web Development', pct: 88 },
  { name: 'Graphic Design & UI Design', pct: 82 },
  { name: 'Computer & Office Applications', pct: 90 },
  { name: 'First Aid & Emergency Care', pct: 78 },
  { name: 'Medication Knowledge & Nursing', pct: 85 }
];

const languages = ['English', 'Arabic', 'Urdu/Hindi'];

const experience = [
  { period:'2016 – 2016', title:'IT Support Technician', org:'Noakhali Technical Training Center', desc:'Provided technical support, system maintenance, troubleshooting, software installation, and user assistance.' },
  { period:'2017 – 2017', title:'Web Development', org:'Learning & Earning Development Project', desc:'Completed hands-on training in web design and development.' },
  { period:'2018 – 2021', title:'Medical Assistant', org:'Al-Habib Hospital Pvt.', desc:'Administered precise injections, emergency treatment, and first aid for patient care.' },
  { period:'2021 – 2022', title:'Office Aide', org:'Life Line Hospital Pvt.', desc:'Assessed, diagnosed, and treated patients, provided care, resulting in 98% satisfaction.' },
  { period:'2022 – 2025', title:'Owner & Pharmacist', org:'Dream Pharmacy', desc:'Responsible for managing prescriptions, patient consultations, and ensuring accurate medication dispensing.' },
  { period:'2025 – 2026', title:'Pharmacy Manager', org:'Shah Ali Pharmacy', desc:'Handled medication dispensing, patient guidance, prescription processing, and pharmacy operations.' }
];

const journal = [
  { img: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=200&q=80', title: 'The nuance of micro-interactions in modern UI', meta: '5 min read · Jan 2026' },
  { img: 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=200&q=80', title: 'Why restraint is the hardest design skill to master', meta: '7 min read · Dec 2025' },
  { img: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=200&q=80', title: 'Building for the next billion users', meta: '4 min read · Nov 2025' },
  { img: 'https://images.unsplash.com/photo-1547658719-da2b51169166?w=200&q=80', title: 'The invisible architecture of great products', meta: '6 min read · Oct 2025' }
];

function initWorks(){
  const grid = document.getElementById('works-grid');
  if(!grid) return;
  grid.innerHTML = works.map(w => `
    <div class="work-card reveal">
      <img class="lazy-img" data-src="${w.src}" alt="${w.title}" decoding="async" width="1600" height="1200"/>
      <div class="work-card-halftone"></div>
      <div class="work-card-hover">
        <div class="work-card-label">View — <em>${w.title}</em></div>
      </div>
    </div>
  `).join('');
}

function initExperience(){
  const list = document.getElementById('experience-list');
  if(!list) return;
  list.innerHTML = experience.map(x => `
    <div class="timeline-item reveal">
      <div class="timeline-period">${x.period}</div>
      <div class="timeline-dot-col"><span class="timeline-dot"></span></div>
      <div class="timeline-body">
        <div class="timeline-title">${x.title}</div>
        <div class="timeline-org">${x.org}</div>
        <p class="timeline-desc">${x.desc}</p>
      </div>
    </div>
  `).join('');
}

function initEducation(){
  const list = document.getElementById('education-list');
  if(!list) return;
  list.innerHTML = education.map(x => `
    <div class="timeline-item reveal">
      <div class="timeline-period">${x.period}</div>
      <div class="timeline-dot-col"><span class="timeline-dot"></span></div>
      <div class="timeline-body">
        <div class="timeline-title">${x.title}</div>
        <div class="timeline-org">${x.org}</div>
        <p class="timeline-desc">${x.desc}</p>
      </div>
    </div>
  `).join('');
}

function initCertifications(){
  const grid = document.getElementById('cert-grid');
  if(grid){
    grid.innerHTML = certifications.map(c => `
      <div class="cert-badge reveal">
        <span class="cert-badge-icon">✓</span>
        <span class="cert-badge-text">${c}</span>
      </div>
    `).join('');
  }
  const skillsGrid = document.getElementById('skills-grid');
  if(skillsGrid){
    skillsGrid.classList.add('skill-bars');
    skillsGrid.innerHTML = skills.map(s => `
      <div class="skill-bar reveal">
        <div class="skill-bar-head">
          <span class="skill-bar-name">${s.name}</span>
          <span class="skill-bar-pct">${s.pct}%</span>
        </div>
        <div class="skill-bar-track">
          <div class="skill-bar-fill" style="--w:${s.pct}%"></div>
        </div>
      </div>
    `).join('');
  }
  const langList = document.getElementById('lang-list');
  if(langList){
    langList.innerHTML = languages.map(l => `<span class="chip chip-outline reveal">${l}</span>`).join('');
  }
}

function initJournal(){
  const list = document.getElementById('journal-list');
  if(!list) return;
  list.innerHTML = journal.map(j => `
    <div class="journal-item reveal">
      <img class="journal-img lazy-img" data-src="${j.img}" alt="" decoding="async" width="48" height="48"/>
      <div>
        <div class="journal-title">${j.title}</div>
        <div class="journal-meta">${j.meta}</div>
      </div>
      <span class="journal-arrow">↗</span>
    </div>
  `).join('');
}

/* ───────────────────────────────────────────
   BACK TO TOP
─────────────────────────────────────────── */
function initBackToTop(){
  const btn = document.getElementById('back-to-top');
  if(!btn) return;
  let ticking = false;
  const toggle = () => {
    btn.classList.toggle('visible', window.scrollY > 500);
  };
  window.addEventListener('scroll', () => {
    if(!ticking){
      requestAnimationFrame(() => { toggle(); ticking = false; });
      ticking = true;
    }
  }, { passive:true });
  btn.addEventListener('click', () => {
    window.scrollTo({ top:0, behavior:'smooth' });
  });
}

/* ───────────────────────────────────────────
   SCROLL PROGRESS
─────────────────────────────────────────── */
function initScrollProgress(){
  const bar = document.getElementById('scroll-progress');
  if(!bar) return;
  let ticking = false;
  const update = () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const progress = h > 0 ? window.scrollY / h : 0;
    bar.style.transform = `scaleX(${Math.min(1, progress)})`;
  };
  window.addEventListener('scroll', () => {
    if(!ticking){
      requestAnimationFrame(() => { update(); ticking = false; });
      ticking = true;
    }
  }, { passive:true });
  update();
}

/* ───────────────────────────────────────────
   TOAST NOTIFICATIONS (replaces alert())
─────────────────────────────────────────── */
function initToast(){
  document.querySelectorAll('[data-alert]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      showToast(btn.dataset.alert);
    });
  });
}
function showToast(message){
  const container = document.getElementById('toast-container');
  if(!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
